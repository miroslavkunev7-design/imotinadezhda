// SPDX-License-Identifier: MIT
// The Real GPT module on top of the app's real egress (electron/backend/http.js) and the real encrypted store
// (electron/store/secure-file.js), exactly as electron/main.js wires them. Only `fetch` and safeStorage are fakes.
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALLOWED_HOSTS } from '../../electron/backend/config.js';
import { createHttp } from '../../electron/backend/http.js';
import { createRealGpt } from '../../electron/realgpt/index.js';
import { createSecureStore } from '../../electron/store/secure-file.js';

const FULL_SCOPE = 'chatgpt.tokens.use.direct email offline_access openid profile resource.invoke';
const sse = (obj) => `event: ${obj.type}\ndata: ${JSON.stringify(obj)}\n\n`;

// Reversible stand-in for Electron safeStorage (DPAPI).
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from(`enc1:${Buffer.from(String(s), 'utf8').toString('hex')}`),
  decryptString: (buf) => Buffer.from(Buffer.from(buf).toString('utf8').slice(5), 'hex').toString('utf8'),
};

function get(url) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, { method: 'GET', agent: false }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

let dir;
let key;
let publicJwk;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'rg-wiring-'));
  key = await generateKeyPair('RS256');
  publicJwk = { ...(await exportJWK(key.publicKey)), kid: 'k1', alg: 'RS256' };
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('Real GPT through the real http egress and secure store', () => {
  it('signs in, lists models, streams an answer, refreshes on 401 and signs out', async () => {
    const fetched = [];
    let authUrl;
    let modelCalls = 0;
    // Stand-in for the network: answers per URL like the documented endpoints.
    const fetchImpl = async (url, init) => {
      fetched.push({ url, init });
      const { pathname } = new URL(url);
      const params = new URLSearchParams(typeof init.body === 'string' ? init.body : '');
      if (pathname === '/.well-known/jwks.json') return Response.json({ keys: [publicJwk] });
      if (pathname === '/api/accounts/oauth/token' && params.get('grant_type') === 'authorization_code') {
        const idToken = await new SignJWT({ nonce: authUrl.searchParams.get('nonce'), email: 'user@example.com', sub: 'sub-1' })
          .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
          .setIssuer('https://auth.openai.com')
          .setAudience([params.get('client_id')])
          .setIssuedAt()
          .setExpirationTime('1h')
          .sign(key.privateKey);
        return Response.json({ access_token: 'at-1', refresh_token: 'rt-1', id_token: idToken, token_type: 'Bearer', expires_in: 3600, scope: FULL_SCOPE });
      }
      if (pathname === '/api/accounts/oauth/token') {
        return Response.json({ access_token: 'at-2', refresh_token: 'rt-2', token_type: 'Bearer', expires_in: 3600, scope: FULL_SCOPE });
      }
      if (pathname === '/api/accounts/oauth/revoke') return new Response('', { status: 200 });
      if (pathname === '/v1/models') {
        modelCalls += 1;
        if (modelCalls === 1) return Response.json({ error: { code: 'subscription_sharing_invalid_user' } }, { status: 401 });
        return Response.json({ models: [{ slug: 'model-a', display_name: 'Model A', visibility: 'list' }, { slug: 'x', visibility: 'hide' }] });
      }
      if (pathname === '/v1/responses') {
        if (JSON.parse(init.body).reasoning) {
          return Response.json({ error: { code: 'subscription_sharing_unsupported_capability', param: 'reasoning.effort' } }, { status: 400 });
        }
        const text = sse({ type: 'response.output_text.delta', delta: 'Добър ' }) + sse({ type: 'response.output_text.delta', delta: 'ден!' }) +
          sse({ type: 'response.completed', response: { model: 'model-a-2026', status: 'completed' } });
        return new Response(text, { status: 200, headers: { 'content-type': 'text/event-stream', 'x-request-id': 'req_1' } });
      }
      return new Response('not found', { status: 404 });
    };

    const logs = [];
    const log = { info: (e, f) => logs.push([e, f]), warn: (e, f) => logs.push([e, f]), error: (e, f) => logs.push([e, f]) };
    const emitted = [];
    const rg = createRealGpt({
      http: createHttp({ fetchImpl, log }),
      secureStore: createSecureStore({ dir: path.join(dir, 'secure'), safeStorage }),
      dataDir: path.join(dir, 'realgpt'),
      log,
      emit: (channel, payload) => emitted.push([channel, payload]),
      deltaIntervalMs: 0,
      openExternal: async (url) => {
        authUrl = new URL(url);
        const back = new URLSearchParams({ code: 'auth-code', state: authUrl.searchParams.get('state'), client_id: 'oaiapp_issued' });
        get(`${authUrl.searchParams.get('redirect_uri')}?${back}`).catch(() => {});
      },
    });

    expect(await rg.signIn()).toEqual({ ok: true, status: { connected: true, email: 'user@example.com', planEnabled: true } });
    expect(await rg.models()).toEqual({ ok: true, models: [{ slug: 'model-a', displayName: 'Model A' }] });
    expect(await rg.send({ requestId: 'r1', messages: [{ role: 'user', text: 'Здравей' }], model: 'model-a', effort: 'high' }))
      .toEqual({ ok: true, text: 'Добър ден!', model: 'model-a-2026', effortIgnored: true });
    expect(emitted.map(([, p]) => p.delta).join('')).toBe('Добър ден!');
    expect(await rg.signOut()).toEqual({ ok: true, revoked: true });
    expect(await rg.status()).toEqual({ connected: false });

    // Every request stayed on the allowlisted OpenAI hosts, over https, without Origin/Referer.
    for (const { url, init } of fetched) {
      const u = new URL(url);
      expect(u.protocol).toBe('https:');
      expect(['auth.openai.com', 'api.openai.com']).toContain(u.hostname);
      expect(ALLOWED_HOSTS).toContain(u.hostname);
      const names = Object.keys(init.headers).map((h) => h.toLowerCase());
      expect(names).not.toContain('origin');
      expect(names).not.toContain('referer');
      expect(new Set(names).size).toBe(names.length); // no duplicated header such as two content-types
    }
    const paths = fetched.map((f) => `${f.init.method} ${new URL(f.url).pathname}`);
    expect(paths).toEqual([
      'POST /api/accounts/oauth/token',
      'GET /.well-known/jwks.json',
      'GET /v1/models',
      'POST /api/accounts/oauth/token', // refresh after the 401
      'GET /v1/models',
      'POST /v1/responses',
      'POST /v1/responses', // the corrected retry without reasoning
      'POST /api/accounts/oauth/revoke',
    ]);
    const tokenCall = fetched[0].init;
    expect(tokenCall.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(new URLSearchParams(tokenCall.body).get('client_id')).toBe('oaiapp_issued');
    const responsesCall = fetched[5].init;
    expect(responsesCall.headers['Content-Type']).toBe('application/json');
    expect(responsesCall.headers.Authorization).toBe('Bearer at-2');
    expect(JSON.parse(responsesCall.body)).toMatchObject({ store: false, stream: true });

    // On disk: an encrypted record without tokens after sign-out, and the host id; nothing in the log.
    const files = await readdir(path.join(dir, 'secure'));
    expect(files).toEqual(['realgpt.bin']);
    const stored = await readFile(path.join(dir, 'secure', 'realgpt.bin'), 'utf8');
    expect(stored.startsWith('enc1:')).toBe(true);
    expect(stored).not.toContain('oaiapp_issued');
    expect(await readdir(path.join(dir, 'realgpt'))).toEqual(['realgpt-host.json']);
    const logged = JSON.stringify(logs);
    for (const secret of ['at-1', 'rt-1', 'at-2', 'rt-2', 'auth-code', authUrl.searchParams.get('state')]) expect(logged).not.toContain(secret);
  });

  it('a host outside the allowlist cannot be reached through the module', async () => {
    const http = createHttp({ fetchImpl: async () => { throw new Error('must not be called'); } });
    await expect(http.request({ url: 'https://chatgpt.com/backend-api/x' })).rejects.toMatchObject({ code: 'host' });
  });
});
