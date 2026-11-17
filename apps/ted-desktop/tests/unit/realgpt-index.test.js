// SPDX-License-Identifier: MIT
// End-to-end tests of createRealGpt with a fake http, an in-memory secure store, a real loopback callback on
// 127.0.0.1 and locally signed ID tokens. Nothing leaves the machine.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createRealGpt } from '../../electron/realgpt/index.js';

const TOKEN_URL = 'https://auth.openai.com/api/accounts/oauth/token';
const REVOKE_URL = 'https://auth.openai.com/api/accounts/oauth/revoke';
const MODELS_URL = 'https://api.openai.com/v1/models';
const RESPONSES_URL = 'https://api.openai.com/v1/responses';
const FULL_SCOPE = 'chatgpt.tokens.use.direct email offline_access openid profile resource.invoke';
const HOUR = 3600 * 1000;

const enc = new TextEncoder();
const sse = (obj) => `event: ${obj.type}\ndata: ${JSON.stringify(obj)}\n\n`;
const delta = (text) => sse({ type: 'response.output_text.delta', delta: text });
const completed = (model = 'srv-model') => sse({ type: 'response.completed', response: { model, status: 'completed' } });
const form = (opts) => Object.fromEntries(new URLSearchParams(opts.body));
const hello = [{ role: 'user', text: 'Здравей' }];

const textRes = (status, body, headers = {}) => ({
  status, ok: status >= 200 && status < 300, headers: new Headers(headers),
  text: typeof body === 'string' ? body : JSON.stringify(body),
});
// Streaming response as http.request({as:"stream"}) returns it; `hold` keeps the stream open after the chunks.
function streamRes(status, chunks, { hold = false, onCancel } = {}) {
  const queue = [...chunks];
  const body = new ReadableStream({
    pull(c) {
      if (queue.length) c.enqueue(enc.encode(queue.shift()));
      else if (!hold) c.close();
      else return new Promise(() => {});
      return undefined;
    },
    cancel() { onCancel?.(); },
  });
  return { status, ok: status >= 200 && status < 300, headers: new Headers({ 'x-request-id': 'req_test' }), body };
}
const errorRes = (status, body) => streamRes(status, [JSON.stringify(body)]);

function call(url) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, { method: 'GET', agent: false }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function waitFor(check, ms = 2000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
}

let key;
let jwks;
beforeAll(async () => {
  key = await generateKeyPair('RS256');
  jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(key.publicKey)), kid: 'k1', alg: 'RS256' }] });
});

const idToken = ({ aud, nonce, sub, email }) =>
  new SignJWT({ nonce, email, sub })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer('https://auth.openai.com')
    .setAudience([aud])
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key.privateKey);

const dirs = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

// One isolated module instance with scriptable collaborators.
async function makeEnv(options = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'rg-index-'));
  dirs.push(dataDir);
  const env = {
    dataDir,
    store: new Map(),
    calls: [],
    opened: [],
    emitted: [],
    logs: [],
    now: Date.now(),
    scope: FULL_SCOPE,
    identity: { sub: 'sub-1', email: 'user@example.com' },
    callbackParams: { code: 'auth-code-1', client_id: 'oaiapp_issued_1', scope: FULL_SCOPE },
    refreshes: 0,
    available: true,
    writable: true,
  };
  env.callsTo = (url) => env.calls.filter((c) => c.url === url);
  env.record = () => env.store.get('realgpt');
  // The "browser": follows the authorize URL straight back to the loopback redirect.
  env.visit = (params) => {
    const redirect = env.authUrl.searchParams.get('redirect_uri');
    const query = new URLSearchParams({ state: env.authUrl.searchParams.get('state'), ...params });
    return call(`${redirect}?${query}`);
  };
  env.onOpen = () => {
    env.page = env.visit(env.callbackParams);
  };
  env.onToken = async (opts) => {
    const f = form(opts);
    if (f.grant_type === 'authorization_code') {
      const nonce = env.tokenNonce ?? env.authUrl.searchParams.get('nonce');
      return textRes(200, {
        access_token: 'at-1', refresh_token: 'rt-1', token_type: 'Bearer', expires_in: 3600, scope: env.scope,
        id_token: await idToken({ aud: f.client_id, nonce, ...env.identity }),
      });
    }
    env.refreshes += 1;
    const n = env.refreshes + 1;
    return textRes(200, { access_token: `at-${n}`, refresh_token: `rt-${n}`, token_type: 'Bearer', expires_in: 3600, scope: env.scope });
  };
  env.onRevoke = () => textRes(200, '');
  env.onModels = () => textRes(200, { models: [{ slug: 'model-a', display_name: 'Model A', visibility: 'list' }] });
  env.onResponses = () => streamRes(200, [delta('Здра'), delta('вей!'), completed()]);

  const http = {
    request: async (opts) => {
      env.calls.push(opts);
      if (opts.url === TOKEN_URL) return env.onToken(opts);
      if (opts.url === REVOKE_URL) return env.onRevoke(opts);
      if (opts.url === MODELS_URL) return env.onModels(opts);
      if (opts.url === RESPONSES_URL) return env.onResponses(opts);
      throw Object.assign(new Error(`unexpected url ${opts.url}`), { code: 'host' });
    },
  };
  // Same behaviour as electron/store/secure-file.js: synchronous, write() returns false without encryption.
  const secureStore = {
    available: () => env.available,
    read: (name) => structuredClone(env.store.get(name) ?? null),
    write: (name, value) => {
      if (!env.writable) return false;
      env.store.set(name, structuredClone(value));
      return true;
    },
    remove: (name) => { env.store.delete(name); },
  };
  const level = (name) => (event, fields) => env.logs.push([name, event, fields]);
  env.rg = createRealGpt({
    http,
    secureStore,
    dataDir,
    openExternal: async (url) => {
      env.opened.push(url);
      env.authUrl = new URL(url);
      return env.onOpen(url);
    },
    log: { info: level('info'), warn: level('warn'), error: level('error') },
    emit: (channel, payload) => env.emitted.push([channel, payload]),
    jwks,
    now: () => env.now,
    sleep: async () => {},
    deltaIntervalMs: 0,
    ...options,
  });
  return env;
}

async function signedIn(options) {
  const env = await makeEnv(options);
  expect(await env.rg.signIn()).toMatchObject({ ok: true });
  return env;
}

describe('sign-in', () => {
  it('first registration: dynamic client in the browser, issued client id everywhere after', async () => {
    const env = await makeEnv();
    expect(await env.rg.status()).toEqual({ connected: false });
    const result = await env.rg.signIn();
    expect(result).toEqual({ ok: true, status: { connected: true, email: 'user@example.com', planEnabled: true } });

    expect(env.opened).toHaveLength(1);
    const q = env.authUrl.searchParams;
    expect(q.get('client_id')).toBe('dynamic_agent_client');
    expect(q.get('agent_name_hint')).toBe('Ted for Windows');
    expect(q.get('redirect_uri')).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/auth\/callback$/);
    expect(q.get('code_challenge_method')).toBe('S256');

    const [exchange] = env.callsTo(TOKEN_URL);
    const f = form(exchange);
    expect(f).toMatchObject({
      grant_type: 'authorization_code', client_id: 'oaiapp_issued_1', code: 'auth-code-1',
      redirect_uri: q.get('redirect_uri'), resource: 'https://api.openai.com/v1',
    });
    expect(f.code_verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);

    const record = env.record();
    expect(Object.keys(record).sort()).toEqual([
      'access_token', 'client_id', 'earliest_refresh_at', 'email', 'expires_in', 'ext_agent_host_id', 'id_token',
      'issuer', 'refresh_token', 'saved_at', 'scopes', 'subject', 'token_type',
    ]);
    expect(record).toMatchObject({ client_id: 'oaiapp_issued_1', subject: 'sub-1', access_token: 'at-1', refresh_token: 'rt-1' });

    // Host id: persisted in dataDir, sent to the authorize endpoint and stored with the record.
    const host = JSON.parse(await readFile(path.join(env.dataDir, 'realgpt-host.json'), 'utf8')).ext_agent_host_id;
    expect(host).toMatch(/^urn:uuid:/);
    expect(q.get('ext_agent_host_id')).toBe(host);
    expect(record.ext_agent_host_id).toBe(host);

    const page = await env.page;
    expect(page.status).toBe(200);
    expect(page.body).toContain('Входът е завършен');
    expect(await env.rg.status()).toEqual({ connected: true, email: 'user@example.com', planEnabled: true });
  });

  it('keeps the sign-in but disables plan use when chatgpt.tokens.use.direct was not granted', async () => {
    const env = await makeEnv();
    env.scope = 'email offline_access openid profile resource.invoke';
    expect(await env.rg.signIn()).toEqual({ ok: true, status: { connected: true, email: 'user@example.com', planEnabled: false } });
    const sent = await env.rg.send({ requestId: 'r1', messages: hello, model: 'model-a' });
    expect(sent).toMatchObject({ ok: false, code: 'plan_disabled' });
    expect(await env.rg.models()).toMatchObject({ ok: false, code: 'plan_disabled' });
    expect(env.calls.filter((c) => c.url.startsWith('https://api.openai.com'))).toHaveLength(0);

    // Signing in again is the request to enable plan use: the consent screen is asked for once more.
    env.scope = FULL_SCOPE;
    env.callbackParams = { code: 'auth-code-2' };
    expect(await env.rg.signIn()).toMatchObject({ ok: true, status: { planEnabled: true } });
    expect(env.authUrl.searchParams.get('prompt')).toBe('consent');
    expect(env.authUrl.searchParams.get('client_id')).toBe('oaiapp_issued_1');
    expect((await env.rg.send({ requestId: 'r2', messages: hello, model: 'model-a' })).ok).toBe(true);

    // An ordinary re-authorisation with plan use granted does not force consent.
    expect(await env.rg.signIn()).toMatchObject({ ok: true });
    expect(env.authUrl.searchParams.has('prompt')).toBe(false);
  });

  it('returning sign-in reuses the issued client id and the host id, without agent_name_hint', async () => {
    const env = await signedIn();
    const firstHost = env.authUrl.searchParams.get('ext_agent_host_id');
    await env.rg.signOut();
    env.callbackParams = { code: 'auth-code-2' }; // re-authorisation may omit client_id
    expect(await env.rg.signIn()).toMatchObject({ ok: true, status: { connected: true } });
    const q = env.authUrl.searchParams;
    expect(q.get('client_id')).toBe('oaiapp_issued_1');
    expect(q.has('agent_name_hint')).toBe(false);
    expect(q.get('login_hint')).toBe('user@example.com');
    expect(q.has('id_token_hint')).toBe(false); // the ID token was removed at sign-out
    expect(q.get('ext_agent_host_id')).toBe(firstHost);
    expect(form(env.callsTo(TOKEN_URL).at(-1))).toMatchObject({ client_id: 'oaiapp_issued_1', code: 'auth-code-2' });
    expect(env.record().client_id).toBe('oaiapp_issued_1');
  });

  it('rejects a different client id or a different account on re-authorisation', async () => {
    const env = await signedIn();
    await env.rg.signOut();
    const kept = env.record();

    env.callbackParams = { code: 'c', client_id: 'oaiapp_someone_else' };
    expect(await env.rg.signIn()).toMatchObject({ ok: false, code: 'oauth' });
    expect(env.callsTo(TOKEN_URL)).toHaveLength(1); // no second exchange
    expect(env.record()).toEqual(kept);

    env.callbackParams = { code: 'c' };
    env.identity = { sub: 'sub-2', email: 'other@example.com' };
    expect(await env.rg.signIn()).toMatchObject({ ok: false, code: 'account_mismatch' });
    expect(env.record()).toEqual(kept);
    expect(await env.rg.status()).toEqual({ connected: false });
    expect((await env.page).body).toContain('Входът не беше завършен');

    // An explicit new registration is the way to another account.
    env.callbackParams = { code: 'c', client_id: 'oaiapp_issued_2' };
    expect(await env.rg.signIn({ newAccount: true })).toMatchObject({ ok: true, status: { email: 'other@example.com' } });
    expect(env.authUrl.searchParams.get('client_id')).toBe('dynamic_agent_client');
    expect(env.authUrl.searchParams.has('login_hint')).toBe(false);
    expect(env.record()).toMatchObject({ client_id: 'oaiapp_issued_2', subject: 'sub-2' });
  });

  it('access_denied stops the attempt without a token exchange', async () => {
    const env = await makeEnv();
    env.callbackParams = { error: 'access_denied' };
    const result = await env.rg.signIn();
    expect(result).toMatchObject({ ok: false, code: 'access_denied' });
    expect(result.error).toMatch(/отказан/);
    expect(env.calls).toHaveLength(0);
    expect((await env.page).body).toContain('Входът беше отказан');
    expect(env.record()).toBeUndefined();
  });

  it('a new registration without an issued client id is incomplete', async () => {
    const env = await makeEnv();
    for (const params of [{ code: 'c' }, { code: 'c', client_id: 'dynamic_agent_client' }]) {
      env.callbackParams = params;
      expect(await env.rg.signIn()).toMatchObject({ ok: false, code: 'registration' });
    }
    expect(env.calls).toHaveLength(0);
  });

  it('an ID token that fails verification is never accepted; the issued registration is kept for the retry', async () => {
    const env = await makeEnv();
    env.tokenNonce = 'not-the-nonce-of-this-attempt';
    expect(await env.rg.signIn()).toMatchObject({ ok: false, code: 'id_token' });
    expect(await env.rg.status()).toEqual({ connected: false });
    expect(env.record()).toEqual({ client_id: 'oaiapp_issued_1', ext_agent_host_id: expect.stringMatching(/^urn:uuid:/) });

    env.tokenNonce = undefined;
    env.callbackParams = { code: 'auth-code-2' };
    expect(await env.rg.signIn()).toMatchObject({ ok: true });
    expect(env.authUrl.searchParams.get('client_id')).toBe('oaiapp_issued_1');
    expect(env.authUrl.searchParams.has('agent_name_hint')).toBe(false);
  });

  it('a failed code exchange reports the OAuth code', async () => {
    const env = await makeEnv();
    env.onToken = () => textRes(400, { error: 'invalid_grant' });
    const result = await env.rg.signIn();
    expect(result).toMatchObject({ ok: false, code: 'oauth' });
    expect(result.error).toContain('invalid_grant');
    expect(await env.rg.status()).toEqual({ connected: false });
  });

  it('cancelSignIn closes the listener and ends the waiting call', async () => {
    const env = await makeEnv();
    env.onOpen = () => {};
    const pending = env.rg.signIn();
    await waitFor(() => env.opened.length === 1);
    const redirect = env.authUrl.searchParams.get('redirect_uri');
    expect(env.rg.cancelSignIn()).toEqual({ ok: true });
    expect(await pending).toMatchObject({ ok: false, code: 'cancelled' });
    await expect(call(`${redirect}?state=${env.authUrl.searchParams.get('state')}&code=late`)).rejects.toThrow();
    expect(env.calls).toHaveLength(0);
    expect(env.rg.cancelSignIn()).toEqual({ ok: true }); // nothing pending is fine
  });

  it('a new attempt replaces an unfinished one', async () => {
    const env = await makeEnv();
    env.onOpen = () => {};
    const first = env.rg.signIn();
    await waitFor(() => env.opened.length === 1);
    env.onOpen = () => { env.page = env.visit(env.callbackParams); };
    const second = env.rg.signIn();
    expect(await first).toMatchObject({ ok: false, code: 'cancelled' });
    expect(await second).toMatchObject({ ok: true });
    expect(env.callsTo(TOKEN_URL)).toHaveLength(1);
  });

  it('times out when the browser never returns', async () => {
    const env = await makeEnv({ signInTimeoutMs: 40 });
    env.onOpen = () => {};
    const result = await env.rg.signIn();
    expect(result).toMatchObject({ ok: false, code: 'signin_timeout' });
    expect(result.error).toMatch(/5 минути/);
  });

  it('does not start without encrypted storage or without a browser', async () => {
    const noStore = await makeEnv();
    noStore.available = false;
    expect(await noStore.rg.signIn()).toMatchObject({ ok: false, code: 'storage' });
    expect(noStore.opened).toHaveLength(0);

    const noBrowser = await makeEnv();
    noBrowser.onOpen = () => { throw new Error('no handler'); };
    expect(await noBrowser.rg.signIn()).toMatchObject({ ok: false, code: 'browser' });
    const redirect = noBrowser.authUrl.searchParams.get('redirect_uri');
    await expect(call(redirect)).rejects.toThrow(); // listener closed

    const refused = await makeEnv();
    refused.onOpen = () => ({ ok: false, error: 'blocked' });
    expect(await refused.rg.signIn()).toMatchObject({ ok: false, code: 'browser' });
  });

  it('is not reported as connected when the credentials could not be stored encrypted', async () => {
    const env = await makeEnv();
    env.writable = false; // secure store refuses to write (it never falls back to plaintext)
    expect(await env.rg.signIn()).toMatchObject({ ok: false, code: 'storage' });
    expect(await env.rg.status()).toEqual({ connected: false });
    expect(env.store.size).toBe(0);
    expect((await env.page).body).toContain('Входът не беше завършен');
  });
});

describe('token refresh', () => {
  it('is single-flight: concurrent calls share one rotation', async () => {
    const env = await signedIn();
    env.now += HOUR + 1000; // access token expired
    const original = env.onToken;
    env.onToken = async (opts) => {
      await new Promise((r) => setTimeout(r, 20));
      return original(opts);
    };
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => env.rg.models()));
    for (const r of results) expect(r.ok).toBe(true);
    expect(env.refreshes).toBe(1);
    const refresh = form(env.callsTo(TOKEN_URL).at(-1));
    expect(refresh).toEqual({ grant_type: 'refresh_token', client_id: 'oaiapp_issued_1', refresh_token: 'rt-1', resource: 'https://api.openai.com/v1' });
    for (const c of env.callsTo(MODELS_URL)) expect(c.headers.Authorization).toBe('Bearer at-2');
    expect(env.record()).toMatchObject({ access_token: 'at-2', refresh_token: 'rt-2', saved_at: new Date(env.now).toISOString() });
  });

  it('does not refresh a token that is still fresh', async () => {
    const env = await signedIn();
    env.now += 10 * 60 * 1000;
    await env.rg.models();
    expect(env.refreshes).toBe(0);
    expect(env.callsTo(MODELS_URL)[0].headers.Authorization).toBe('Bearer at-1');
  });

  it.each([
    'invalid_grant', 'invalid_refresh_token', 'token_expired', 'refresh_token_expired', 'refresh_token_invalidated',
    'refresh_token_reused',
  ])('terminal %s clears the tokens and keeps client id and host id', async (code) => {
    const env = await signedIn();
    const before = env.record();
    env.now += HOUR + 1000;
    env.onToken = () => textRes(400, { error: code });
    const result = await env.rg.models();
    expect(result).toMatchObject({ ok: false, code: 'reauth' });
    expect(result.error).toMatch(/Влезте отново/);
    const after = env.record();
    expect(after).not.toHaveProperty('access_token');
    expect(after).not.toHaveProperty('refresh_token');
    expect(after).toMatchObject({ client_id: before.client_id, ext_agent_host_id: before.ext_agent_host_id, subject: 'sub-1' });
    expect(await env.rg.status()).toEqual({ connected: false });
    expect(env.callsTo(MODELS_URL)).toHaveLength(0);
    expect(await env.rg.send({ requestId: 'r', messages: hello, model: 'm' })).toMatchObject({ ok: false, code: 'not_connected' });
  });

  it('after a terminal refresh the next sign-in hints the same account', async () => {
    const env = await signedIn();
    const oldIdToken = env.record().id_token;
    env.now += HOUR + 1000;
    env.onToken = () => textRes(400, { error: 'refresh_token_expired' });
    await env.rg.models();
    env.onOpen = () => {};
    const pending = env.rg.signIn();
    await waitFor(() => env.opened.length === 2);
    expect(env.authUrl.searchParams.get('client_id')).toBe('oaiapp_issued_1');
    expect(env.authUrl.searchParams.get('id_token_hint')).toBe(oldIdToken);
    expect(env.authUrl.searchParams.get('login_hint')).toBe('user@example.com');
    env.rg.cancelSignIn();
    await pending;
  });

  it('a temporary refresh failure keeps the credentials', async () => {
    const env = await signedIn();
    const before = env.record();
    env.now += HOUR + 1000;
    env.onToken = () => textRes(503, 'unavailable');
    expect(await env.rg.models()).toMatchObject({ ok: false, code: 'unavailable' });
    expect(env.record()).toEqual(before);
    env.onToken = () => { throw Object.assign(new Error('offline'), { code: 'network' }); };
    expect(await env.rg.models()).toMatchObject({ ok: false, code: 'network' });
    expect(env.record()).toEqual(before);
    expect(await env.rg.status()).toMatchObject({ connected: true });
  });

  it('near expiry a failed refresh still lets the valid token through', async () => {
    const env = await signedIn();
    env.now += 57 * 60 * 1000; // inside the refresh window, not yet expired
    env.onToken = () => textRes(503, 'unavailable');
    expect(await env.rg.models()).toMatchObject({ ok: true });
    expect(env.callsTo(MODELS_URL)[0].headers.Authorization).toBe('Bearer at-1');
  });

  it('HTTP 401 refreshes once and retries once', async () => {
    const env = await signedIn();
    env.onModels = (opts) => (opts.headers.Authorization === 'Bearer at-1' ? textRes(401, { error: { code: 'subscription_sharing_invalid_user' } }) : textRes(200, { models: [] }));
    expect(await env.rg.models()).toEqual({ ok: true, models: [] });
    expect(env.refreshes).toBe(1);
    expect(env.callsTo(MODELS_URL).map((c) => c.headers.Authorization)).toEqual(['Bearer at-1', 'Bearer at-2']);

    env.onModels = () => textRes(401, { error: { code: 'subscription_sharing_invalid_user' } });
    expect(await env.rg.models()).toMatchObject({ ok: false, code: 'auth' });
    expect(env.refreshes).toBe(2);
    expect(env.callsTo(MODELS_URL)).toHaveLength(4); // exactly one retry, no loop
    expect(await env.rg.status()).toMatchObject({ connected: true }); // a 401 alone does not erase credentials
  });
});

describe('sign-out', () => {
  it('revokes the refresh token, clears the tokens and keeps the registration', async () => {
    const env = await signedIn();
    expect(await env.rg.signOut()).toEqual({ ok: true, revoked: true });
    const [revoke] = env.callsTo(REVOKE_URL);
    expect(revoke.method).toBe('POST');
    expect(form(revoke)).toEqual({ token: 'rt-1', token_type_hint: 'refresh_token', client_id: 'oaiapp_issued_1' });
    expect(env.record()).toEqual({
      email: 'user@example.com', issuer: 'https://auth.openai.com', subject: 'sub-1', client_id: 'oaiapp_issued_1',
      ext_agent_host_id: expect.stringMatching(/^urn:uuid:/),
    });
    expect(await env.rg.status()).toEqual({ connected: false });
    expect(await env.rg.models()).toMatchObject({ ok: false, code: 'not_connected' });
  });

  it('clears locally and says so when revocation could not be confirmed', async () => {
    const env = await signedIn();
    env.onRevoke = () => { throw Object.assign(new Error('offline'), { code: 'network' }); };
    expect(await env.rg.signOut()).toEqual({ ok: true, revoked: false });
    expect(env.callsTo(REVOKE_URL)).toHaveLength(3);
    expect(env.record()).not.toHaveProperty('refresh_token');
    expect(await env.rg.status()).toEqual({ connected: false });
  });

  it('removes the tokens even if the registration cannot be rewritten', async () => {
    const env = await signedIn();
    env.writable = false;
    expect(await env.rg.signOut()).toEqual({ ok: true, revoked: true });
    expect(env.store.has('realgpt')).toBe(false);
    expect(await env.rg.status()).toEqual({ connected: false });
  });

  it('without a session there is nothing to revoke', async () => {
    const env = await makeEnv();
    expect(await env.rg.signOut()).toEqual({ ok: true, revoked: false });
    expect(env.calls).toHaveLength(0);
  });

  it('stops running requests', async () => {
    const env = await signedIn();
    env.onResponses = () => streamRes(200, [delta('Започвам')], { hold: true });
    const pending = env.rg.send({ requestId: 'r1', messages: hello, model: 'model-a' });
    await waitFor(() => env.emitted.length === 1);
    await env.rg.signOut();
    expect(await pending).toMatchObject({ ok: false, code: 'aborted', text: 'Започвам' });
  });
});

describe('models', () => {
  it('lists only visibility "list" as {slug, displayName} with the bearer token', async () => {
    const env = await signedIn();
    env.onModels = () => textRes(200, {
      models: [
        { slug: 'model-b', display_name: 'Model B', visibility: 'list' },
        { slug: 'internal', display_name: 'Internal', visibility: 'hide' },
        { slug: 'model-a', display_name: 'Model A', visibility: 'list' },
      ],
    });
    expect(await env.rg.models()).toEqual({
      ok: true,
      models: [{ slug: 'model-b', displayName: 'Model B' }, { slug: 'model-a', displayName: 'Model A' }],
    });
    const [req] = env.callsTo(MODELS_URL);
    expect(req.method).toBe('GET');
    expect(req.headers.Authorization).toBe('Bearer at-1');
  });

  it('reports errors instead of inventing a list', async () => {
    const env = await signedIn();
    env.onModels = () => textRes(403, { error: { code: 'subscription_sharing_user_not_eligible' } });
    expect(await env.rg.models()).toMatchObject({ ok: false, code: 'not_eligible' });
    env.onModels = () => textRes(200, { object: 'list', data: [] });
    expect(await env.rg.models()).toMatchObject({ ok: false, code: 'http' });
    env.onModels = () => { throw Object.assign(new Error('t'), { code: 'timeout' }); };
    expect(await env.rg.models()).toMatchObject({ ok: false, code: 'timeout' });
    expect(await (await makeEnv()).rg.models()).toMatchObject({ ok: false, code: 'not_connected' });
  });
});

describe('send', () => {
  it('streams deltas to the renderer channel and returns the completed answer', async () => {
    const env = await signedIn();
    const result = await env.rg.send({ requestId: 'r1', messages: hello, model: 'model-a' });
    expect(result).toEqual({ ok: true, text: 'Здравей!', model: 'srv-model' });
    expect(env.emitted).toEqual([
      ['realgpt:delta', { requestId: 'r1', delta: 'Здра', text: 'Здра' }],
      ['realgpt:delta', { requestId: 'r1', delta: 'вей!', text: 'Здравей!' }],
    ]);
    const [req] = env.callsTo(RESPONSES_URL);
    expect(req).toMatchObject({ method: 'POST', as: 'stream' });
    expect(req.headers.Authorization).toBe('Bearer at-1');
    expect(req.headers['Content-Type']).toBe('application/json');
    expect(req.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(req.body);
    expect(Object.keys(body).sort()).toEqual(['input', 'instructions', 'model', 'store', 'stream']);
    expect(body).toMatchObject({ model: 'model-a', store: false, stream: true });
    expect(body.instructions).toMatch(/Тед/);
    expect(JSON.stringify(body)).not.toContain('"system"');
  });

  it('coalesces deltas without losing text', async () => {
    const env = await signedIn({ deltaIntervalMs: 50 });
    env.onResponses = () => streamRes(200, [delta('а'), delta('б'), delta('в'), delta('г'), completed()]);
    const result = await env.rg.send({ requestId: 'r1', messages: hello, model: 'model-a' });
    expect(result.text).toBe('абвг');
    expect(env.emitted.length).toBeLessThan(4);
    expect(env.emitted.map(([, p]) => p.delta).join('')).toBe('абвг');
    expect(env.emitted.at(-1)[1].text).toBe('абвг');
  });

  it('passes instructions and effort only when given', async () => {
    const env = await signedIn();
    await env.rg.send({ requestId: 'r1', messages: hello, model: 'model-a', effort: 'high', instructions: 'Отговаряй кратко.' });
    const body = JSON.parse(env.callsTo(RESPONSES_URL)[0].body);
    expect(body.reasoning).toEqual({ effort: 'high' });
    expect(body.instructions).toBe('Отговаряй кратко.');
  });

  it('effort rejected by the route: one corrected retry without reasoning, remembered for the model', async () => {
    const env = await signedIn();
    env.onResponses = (opts) => (JSON.parse(opts.body).reasoning
      ? errorRes(400, { error: { code: 'subscription_sharing_unsupported_capability', param: 'reasoning.effort', message: 'unsupported' } })
      : streamRes(200, [delta('Да.'), completed()]));
    const result = await env.rg.send({ requestId: 'r1', messages: hello, model: 'model-a', effort: 'high' });
    expect(result).toEqual({ ok: true, text: 'Да.', model: 'srv-model', effortIgnored: true });
    const [first, second] = env.callsTo(RESPONSES_URL).map((c) => JSON.parse(c.body));
    expect(env.callsTo(RESPONSES_URL)).toHaveLength(2);
    expect(first.reasoning).toEqual({ effort: 'high' });
    expect(second).not.toHaveProperty('reasoning');
    expect({ ...first, reasoning: undefined }).toEqual({ ...second, reasoning: undefined }); // nothing else changed
    expect(second.model).toBe('model-a'); // never another model

    const again = await env.rg.send({ requestId: 'r2', messages: hello, model: 'model-a', effort: 'low' });
    expect(again).toMatchObject({ ok: true, effortIgnored: true });
    expect(env.callsTo(RESPONSES_URL)).toHaveLength(3); // no wasted round trip
    await env.rg.send({ requestId: 'r3', messages: hello, model: 'model-b', effort: 'low' });
    expect(JSON.parse(env.callsTo(RESPONSES_URL)[3].body).reasoning).toEqual({ effort: 'low' }); // other models are unaffected
  });

  it('does not retry when the unsupported capability is something else or the retry fails too', async () => {
    const env = await signedIn();
    const unsupported = (param) => errorRes(400, { error: { code: 'subscription_sharing_unsupported_capability', param } });
    env.onResponses = () => unsupported('model');
    const other = await env.rg.send({ requestId: 'r1', messages: hello, model: 'model-a', effort: 'high' });
    expect(other).toMatchObject({ ok: false, code: 'unsupported' });
    expect(other.error).toContain('(model)');
    expect(env.callsTo(RESPONSES_URL)).toHaveLength(1);

    env.onResponses = () => unsupported('reasoning.effort');
    const noEffort = await env.rg.send({ requestId: 'r2', messages: hello, model: 'model-c' });
    expect(noEffort).toMatchObject({ ok: false, code: 'unsupported' });
    expect(env.callsTo(RESPONSES_URL)).toHaveLength(2);

    const stillBad = await env.rg.send({ requestId: 'r3', messages: hello, model: 'model-d', effort: 'high' });
    expect(stillBad).toMatchObject({ ok: false, code: 'unsupported' });
    expect(env.callsTo(RESPONSES_URL)).toHaveLength(4); // original + exactly one corrected retry
  });

  it.each([
    [429, { error: { code: 'subscription_sharing_usage_limit_exceeded' } }, 'usage_limit'],
    [403, { error: { code: 'subscription_sharing_user_not_eligible' } }, 'not_eligible'],
    [503, { error: { code: 'subscription_sharing_usage_unavailable' } }, 'unavailable'],
    [403, { error: { code: 'subscription_sharing_route_not_supported' } }, 'config'],
    [503, { detail: 'Direct routing is not enabled' }, 'unavailable'],
    [403, { detail: 'Region is not supported' }, 'forbidden'],
    [400, { error: { code: 'model_not_found', message: 'no such model' } }, 'http'],
  ])('HTTP %i is reported once, in Bulgarian, with no retry and no other model', async (status, body, code) => {
    const env = await signedIn();
    env.onResponses = () => errorRes(status, body);
    const result = await env.rg.send({ requestId: 'r1', messages: hello, model: 'model-a' });
    expect(result).toMatchObject({ ok: false, code });
    expect(result.error).toMatch(/[А-Яа-я]/);
    expect(env.callsTo(RESPONSES_URL)).toHaveLength(1);
    expect(env.emitted).toHaveLength(0);
    expect(await env.rg.status()).toMatchObject({ connected: true }); // credentials are preserved
  });

  it('maps transport failures', async () => {
    const env = await signedIn();
    env.onResponses = () => { throw Object.assign(new Error('fetch failed'), { code: 'network' }); };
    expect(await env.rg.send({ requestId: 'r1', messages: hello, model: 'model-a' })).toMatchObject({ ok: false, code: 'network' });
    env.onResponses = () => { throw Object.assign(new Error('slow'), { code: 'timeout' }); };
    expect(await env.rg.send({ requestId: 'r2', messages: hello, model: 'model-a' })).toMatchObject({ ok: false, code: 'timeout' });
    expect(env.callsTo(RESPONSES_URL)).toHaveLength(2);
  });

  it('a usage limit that arrives mid-stream keeps the partial text', async () => {
    const env = await signedIn();
    env.onResponses = () => streamRes(200, [
      delta('Първата половина'),
      sse({ type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } } }),
    ]);
    expect(await env.rg.send({ requestId: 'r1', messages: hello, model: 'model-a' }))
      .toMatchObject({ ok: false, code: 'usage_limit', text: 'Първата половина' });
  });

  it('incomplete and interrupted streams are never reported as a finished answer', async () => {
    const env = await signedIn();
    env.onResponses = () => streamRes(200, [delta('Недовършено'), sse({ type: 'response.incomplete', response: { incomplete_details: { reason: 'max_output_tokens' } } })]);
    expect(await env.rg.send({ requestId: 'r1', messages: hello, model: 'model-a' }))
      .toEqual({ ok: true, text: 'Недовършено', model: 'model-a', incomplete: true });
    env.onResponses = () => streamRes(200, [delta('Прекъснато')]);
    expect(await env.rg.send({ requestId: 'r2', messages: hello, model: 'model-a' }))
      .toMatchObject({ ok: false, code: 'stream_interrupted', text: 'Прекъснато' });
  });

  it('HTTP 401 refreshes once and retries the same request once', async () => {
    const env = await signedIn();
    env.onResponses = (opts) => (opts.headers.Authorization === 'Bearer at-1'
      ? errorRes(401, { error: { code: 'subscription_sharing_invalid_user' } })
      : streamRes(200, [delta('Готово'), completed()]));
    expect(await env.rg.send({ requestId: 'r1', messages: hello, model: 'model-a' })).toMatchObject({ ok: true, text: 'Готово' });
    const calls = env.callsTo(RESPONSES_URL);
    expect(calls.map((c) => c.headers.Authorization)).toEqual(['Bearer at-1', 'Bearer at-2']);
    expect(calls[0].body).toBe(calls[1].body);
    expect(env.refreshes).toBe(1);
  });

  it('cancel aborts a running stream and returns the partial text', async () => {
    const env = await signedIn();
    let cancelled = false;
    env.onResponses = () => streamRes(200, [delta('Първа част')], { hold: true, onCancel: () => { cancelled = true; } });
    const pending = env.rg.send({ requestId: 'r1', messages: hello, model: 'model-a' });
    await waitFor(() => env.emitted.length === 1);
    expect(env.rg.cancel('r1')).toEqual({ ok: true });
    expect(await pending).toMatchObject({ ok: false, code: 'aborted', text: 'Първа част' });
    expect(cancelled).toBe(true);
    expect(env.callsTo(RESPONSES_URL)[0].signal.aborted).toBe(true);
    expect(env.rg.cancel('unknown')).toEqual({ ok: true });
  });

  it('cancel before the response headers arrive', async () => {
    const env = await signedIn();
    env.onResponses = (opts) => new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { code: 'aborted' })));
    });
    const pending = env.rg.send({ requestId: 'r1', messages: hello, model: 'model-a' });
    await waitFor(() => env.callsTo(RESPONSES_URL).length === 1);
    env.rg.cancel('r1');
    const result = await pending;
    expect(result).toMatchObject({ ok: false, code: 'aborted' });
    expect(result).not.toHaveProperty('text');
  });

  it('a cancel that lands while an error body is being read is still reported as cancelled', async () => {
    const env = await signedIn();
    env.onResponses = () => streamRes(503, [], { hold: true }); // error status whose body never arrives
    const pending = env.rg.send({ requestId: 'r1', messages: hello, model: 'model-a' });
    await waitFor(() => env.callsTo(RESPONSES_URL).length === 1);
    await new Promise((r) => setTimeout(r, 10));
    env.rg.cancel('r1');
    expect(await pending).toMatchObject({ ok: false, code: 'aborted' });
  });

  it('times out on silent headers and on a stalled stream', async () => {
    const slowHeaders = await signedIn({ headersTimeoutMs: 30 });
    slowHeaders.onResponses = (opts) => new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { code: 'aborted' })));
    });
    expect(await slowHeaders.rg.send({ requestId: 'r1', messages: hello, model: 'model-a' })).toMatchObject({ ok: false, code: 'timeout' });

    const stalled = await signedIn({ idleTimeoutMs: 40 });
    stalled.onResponses = () => streamRes(200, [delta('И после тишина')], { hold: true });
    expect(await stalled.rg.send({ requestId: 'r2', messages: hello, model: 'model-a' }))
      .toMatchObject({ ok: false, code: 'timeout', text: 'И после тишина' });
  });

  it('rejects invalid arguments and duplicate request ids before any network call', async () => {
    const env = await signedIn();
    const before = env.calls.length;
    for (const args of [
      undefined,
      { messages: hello, model: 'model-a' },
      { requestId: '', messages: hello, model: 'model-a' },
      { requestId: 'r', messages: [], model: 'model-a' },
      { requestId: 'r', messages: [{ role: 'system', text: 'Ти си друг.' }, ...hello], model: 'model-a' },
      { requestId: 'r', messages: hello },
      { requestId: 'r', messages: hello, model: 'model-a', effort: 'max' },
    ]) {
      expect(await env.rg.send(args)).toMatchObject({ ok: false, code: 'invalid' });
    }
    expect(env.calls.length).toBe(before);

    env.onResponses = () => streamRes(200, [delta('x')], { hold: true });
    const running = env.rg.send({ requestId: 'dup', messages: hello, model: 'model-a' });
    expect(await env.rg.send({ requestId: 'dup', messages: hello, model: 'model-a' })).toMatchObject({ ok: false, code: 'invalid' });
    env.rg.cancel('dup');
    await running;
  });

  it('needs a connection', async () => {
    const env = await makeEnv();
    expect(await env.rg.send({ requestId: 'r1', messages: hello, model: 'model-a' })).toMatchObject({ ok: false, code: 'not_connected' });
    expect(env.calls).toHaveLength(0);
  });
});

describe('secrets stay inside the module', () => {
  it('no token, code, state or verifier reaches results, renderer events or the log', async () => {
    const env = await signedIn();
    const outputs = [await env.rg.status(), await env.rg.models(), await env.rg.send({ requestId: 'r1', messages: hello, model: 'model-a' })];
    env.now += HOUR + 1000;
    outputs.push(await env.rg.models()); // forces a refresh
    env.onResponses = () => errorRes(429, { error: { code: 'subscription_sharing_usage_limit_exceeded' } });
    outputs.push(await env.rg.send({ requestId: 'r2', messages: hello, model: 'model-a' }));
    const record = env.record();
    const exchange = form(env.callsTo(TOKEN_URL)[0]);
    outputs.push(await env.rg.signOut(), await env.rg.status());

    const visible = JSON.stringify([outputs, env.emitted, env.logs]);
    const secrets = [
      'at-1', 'rt-1', 'at-2', 'rt-2', record.id_token, exchange.code, exchange.code_verifier,
      env.authUrl.searchParams.get('state'), env.authUrl.searchParams.get('nonce'),
    ];
    for (const secret of secrets) expect(visible).not.toContain(secret);
    expect(env.logs.length).toBeGreaterThan(0);
  });

  it('the authorize URL carries no token on a first sign-in and the secret store is the only place with tokens', async () => {
    const env = await signedIn();
    expect(env.opened[0]).not.toMatch(/at-1|rt-1|id_token_hint|code_verifier/);
    expect([...env.store.keys()]).toEqual(['realgpt']);
    const hostFile = await readFile(path.join(env.dataDir, 'realgpt-host.json'), 'utf8');
    expect(hostFile).not.toMatch(/at-1|rt-1|user@example\.com/);
  });
});
