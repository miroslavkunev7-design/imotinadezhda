// SPDX-License-Identifier: MIT
import { request as httpRequest } from 'node:http';
import { networkInterfaces } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  AGENT_NAME, AUTHORIZE_URL, REVOKE_URL, TOKEN_URL, buildAuthorizeUrl, exchangeCode, pkceChallenge, randomToken,
  refreshTokens, revokeToken, safeEqual, startLoopback,
} from '../../electron/realgpt/oauth.js';

// Plain node:http client (never proxied) for the loopback listener.
function call(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, { method, agent: false }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

const textRes = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: new Headers(),
  text: typeof body === 'string' ? body : JSON.stringify(body),
});

function fakeHttp(handler) {
  const calls = [];
  return { calls, request: async (opts) => { calls.push(opts); return handler(opts, calls.length); } };
}

const form = (opts) => Object.fromEntries(new URLSearchParams(opts.body));
const settledWithin = (promise, ms) => Promise.race([promise, new Promise((r) => setTimeout(() => r('pending'), ms))]);

describe('PKCE and random values', () => {
  it('matches the RFC 7636 appendix B vector', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('creates fresh URL-safe values long enough for a verifier', () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(a);
  });

  it('compares strings without throwing on different lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', 'x')).toBe(false);
  });
});

describe('authorize URL', () => {
  const base = {
    hostId: 'urn:uuid:11111111-2222-4333-8444-555555555555',
    redirectUri: 'http://127.0.0.1:50123/auth/callback',
    state: 'st-1',
    nonce: 'no-1',
    challenge: 'ch-1',
  };

  it('first registration: exactly the documented parameters with the dynamic client and the name hint', () => {
    const raw = buildAuthorizeUrl(base);
    const url = new URL(raw);
    expect(`${url.origin}${url.pathname}`).toBe(AUTHORIZE_URL);
    expect([...url.searchParams.keys()].sort()).toEqual([
      'agent_name_hint', 'client_id', 'code_challenge', 'code_challenge_method', 'ext_agent_host_id', 'nonce',
      'redirect_uri', 'resource', 'response_type', 'scope', 'state',
    ]);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'dynamic_agent_client',
      agent_name_hint: AGENT_NAME,
      ext_agent_host_id: base.hostId,
      response_type: 'code',
      redirect_uri: base.redirectUri,
      scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
      resource: 'https://api.openai.com/v1',
      state: 'st-1',
      nonce: 'no-1',
      code_challenge_method: 'S256',
      code_challenge: 'ch-1',
    });
    expect(AGENT_NAME).toBe('Ted for Windows');
    expect(raw).not.toContain('+'); // values are percent-encoded
    expect(raw).not.toContain('localhost');
  });

  it('first registration ignores hints of a previous account', () => {
    const url = new URL(buildAuthorizeUrl({ ...base, loginHint: 'a@example.com', idTokenHint: 'x.y.z' }));
    expect(url.searchParams.has('login_hint')).toBe(false);
    expect(url.searchParams.has('id_token_hint')).toBe(false);
  });

  it('returning sign-in: issued client id, hints, no agent_name_hint', () => {
    const url = new URL(buildAuthorizeUrl({ ...base, clientId: 'oaiapp_abc', loginHint: 'user@example.com', idTokenHint: 'aaa.bbb.ccc' }));
    expect([...url.searchParams.keys()].sort()).toEqual([
      'client_id', 'code_challenge', 'code_challenge_method', 'ext_agent_host_id', 'id_token_hint', 'login_hint',
      'nonce', 'redirect_uri', 'resource', 'response_type', 'scope', 'state',
    ]);
    expect(url.searchParams.get('client_id')).toBe('oaiapp_abc');
    expect(url.searchParams.get('login_hint')).toBe('user@example.com');
    expect(url.searchParams.get('id_token_hint')).toBe('aaa.bbb.ccc');
    expect(url.searchParams.get('ext_agent_host_id')).toBe(base.hostId);
  });

  it('asks for consent again only on request and never on a first registration', () => {
    const again = new URL(buildAuthorizeUrl({ ...base, clientId: 'oaiapp_abc', consent: true }));
    expect(again.searchParams.get('prompt')).toBe('consent');
    expect(again.searchParams.get('scope')).toContain('chatgpt.tokens.use.direct'); // the complete scope set
    expect(new URL(buildAuthorizeUrl({ ...base, clientId: 'oaiapp_abc' })).searchParams.has('prompt')).toBe(false);
    expect(new URL(buildAuthorizeUrl({ ...base, consent: true })).searchParams.has('prompt')).toBe(false);
  });

  it('drops an id_token_hint that would make the URL too long for the Windows shell', () => {
    const raw = buildAuthorizeUrl({ ...base, clientId: 'oaiapp_abc', loginHint: 'user@example.com', idTokenHint: 'x'.repeat(2500) });
    expect(raw.length).toBeLessThanOrEqual(2000);
    expect(raw).not.toContain('id_token_hint');
    expect(new URL(raw).searchParams.get('login_hint')).toBe('user@example.com');
  });
});

describe('loopback callback listener', () => {
  it('listens on 127.0.0.1 only, on an ephemeral port, at /auth/callback', async () => {
    const loop = await startLoopback({ state: 's' });
    try {
      expect(loop.host).toBe('127.0.0.1');
      expect(loop.port).toBeGreaterThan(0);
      expect(loop.redirectUri).toBe(`http://127.0.0.1:${loop.port}/auth/callback`);
      const external = Object.values(networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal);
      if (external) await expect(call(`http://${external.address}:${loop.port}/auth/callback?state=s&code=c`)).rejects.toThrow();
      expect(await settledWithin(loop.callback, 30)).toBe('pending');
    } finally {
      loop.close();
    }
  });

  it('rejects wrong paths, methods and states without ending the attempt', async () => {
    const loop = await startLoopback({ state: 'right-state' });
    try {
      expect((await call(`http://127.0.0.1:${loop.port}/callback?state=right-state&code=c`)).status).toBe(404);
      expect((await call(`http://127.0.0.1:${loop.port}/`)).status).toBe(404);
      const post = await call(`${loop.redirectUri}?state=right-state&code=c`, 'POST');
      expect(post.status).toBe(405);
      expect(post.headers.allow).toBe('GET');
      const wrong = await call(`${loop.redirectUri}?state=wrong&code=evil`);
      expect(wrong.status).toBe(400);
      expect(wrong.body).not.toContain('evil');
      expect((await call(loop.redirectUri)).status).toBe(400); // no state at all
      expect(await settledWithin(loop.callback, 30)).toBe('pending');
    } finally {
      loop.close();
    }
  });

  it('accepts the genuine callback once and answers the browser only when the outcome is known', async () => {
    const loop = await startLoopback({ state: 'st' });
    const browser = call(`${loop.redirectUri}?code=the-code&state=st&client_id=oaiapp_issued&scope=openid`);
    expect(await loop.callback).toEqual({ code: 'the-code', error: null, clientId: 'oaiapp_issued' });
    expect(await settledWithin(browser, 40)).toBe('pending'); // held during the token exchange
    expect((await call(`${loop.redirectUri}?code=again&state=st`)).status).toBe(409);
    loop.finish('done');
    const page = await browser;
    expect(page.status).toBe(200);
    expect(page.body).toContain('Входът е завършен');
    expect(page.body).toContain('lang="bg"');
    expect(page.body).not.toMatch(/the-code|oaiapp_issued|<script/);
    expect(page.headers['cache-control']).toBe('no-store');
    expect(page.headers['content-security-policy']).toContain("default-src 'none'");
    await expect(call(loop.redirectUri)).rejects.toThrow(); // listener is closed
  });

  it('reports access_denied without a code and shows the refusal page', async () => {
    const loop = await startLoopback({ state: 'st' });
    const browser = call(`${loop.redirectUri}?error=access_denied&state=st`);
    expect(await loop.callback).toEqual({ code: null, error: 'access_denied', clientId: null });
    loop.finish('denied');
    const page = await browser;
    expect(page.status).toBe(400);
    expect(page.body).toContain('Входът беше отказан');
  });

  it('gives up after the timeout and closes the listener', async () => {
    const loop = await startLoopback({ state: 'st', timeoutMs: 30 });
    expect(await loop.callback).toEqual({ timeout: true });
    await expect(call(`${loop.redirectUri}?state=st&code=c`)).rejects.toThrow();
    loop.close(); // idempotent
  });

  it('close() cancels the attempt and frees the port', async () => {
    const loop = await startLoopback({ state: 'st' });
    loop.close();
    expect(await loop.callback).toEqual({ cancelled: true });
    await expect(call(`${loop.redirectUri}?state=st&code=c`)).rejects.toThrow();
  });
});

describe('token endpoint', () => {
  it('exchanges the code with a form-encoded body including resource and no secret', async () => {
    const tokens = { access_token: 'at', id_token: 'idt', refresh_token: 'rt', scope: 'openid', expires_in: 3600 };
    const http = fakeHttp(() => textRes(200, tokens));
    const out = await exchangeCode(http, {
      clientId: 'oaiapp_abc', code: 'c0de', verifier: 'ver', redirectUri: 'http://127.0.0.1:5/auth/callback',
    });
    expect(out).toEqual(tokens);
    const [req] = http.calls;
    expect(req.url).toBe(TOKEN_URL);
    expect(req.method).toBe('POST');
    expect(req.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(typeof req.body).toBe('string');
    expect(req.json).toBeUndefined();
    expect(form(req)).toEqual({
      grant_type: 'authorization_code',
      client_id: 'oaiapp_abc',
      code: 'c0de',
      code_verifier: 'ver',
      redirect_uri: 'http://127.0.0.1:5/auth/callback',
      resource: 'https://api.openai.com/v1',
    });
  });

  it('turns an OAuth error into an "oauth" failure naming the code', async () => {
    const http = fakeHttp(() => textRes(400, { error: 'invalid_grant' }));
    await expect(exchangeCode(http, { clientId: 'c', code: 'x', verifier: 'v', redirectUri: 'r' }))
      .rejects.toMatchObject({ code: 'oauth', message: expect.stringContaining('invalid_grant') });
  });

  it('refuses a 200 response without an ID token', async () => {
    const http = fakeHttp(() => textRes(200, { access_token: 'at' }));
    await expect(exchangeCode(http, { clientId: 'c', code: 'x', verifier: 'v', redirectUri: 'r' })).rejects.toMatchObject({ code: 'oauth' });
  });

  it('refreshes with the issued client id, the refresh token and resource, without scope', async () => {
    const http = fakeHttp(() => textRes(200, { access_token: 'at2', refresh_token: 'rt2' }));
    const out = await refreshTokens(http, { clientId: 'oaiapp_abc', refreshToken: 'rt1' });
    expect(out).toEqual({ ok: true, tokens: { access_token: 'at2', refresh_token: 'rt2' } });
    expect(http.calls[0].url).toBe(TOKEN_URL);
    expect(form(http.calls[0])).toEqual({
      grant_type: 'refresh_token', client_id: 'oaiapp_abc', refresh_token: 'rt1', resource: 'https://api.openai.com/v1',
    });
  });

  it.each([
    'invalid_grant', 'invalid_refresh_token', 'token_expired', 'refresh_token_expired', 'refresh_token_invalidated',
    'refresh_token_reused',
  ])('treats %s as a terminal refresh error', async (code) => {
    const flat = await refreshTokens(fakeHttp(() => textRes(400, { error: code })), { clientId: 'c', refreshToken: 'r' });
    expect(flat).toMatchObject({ ok: false, terminal: true, code });
    const nested = await refreshTokens(fakeHttp(() => textRes(401, { error: { code, message: 'm' } })), { clientId: 'c', refreshToken: 'r' });
    expect(nested).toMatchObject({ ok: false, terminal: true, code });
  });

  it('does not treat invalid_client, 5xx or junk bodies as terminal', async () => {
    for (const res of [textRes(401, { error: 'invalid_client' }), textRes(503, 'upstream down'), textRes(500, '')]) {
      const out = await refreshTokens(fakeHttp(() => res), { clientId: 'c', refreshToken: 'r' });
      expect(out).toMatchObject({ ok: false, terminal: false });
    }
  });
});

describe('revocation', () => {
  it('confirms on an empty 200 and sends token, hint and client id', async () => {
    const http = fakeHttp(() => textRes(200, ''));
    expect(await revokeToken(http, { clientId: 'oaiapp_abc', refreshToken: 'rt1', sleep: async () => {} })).toBe(true);
    expect(http.calls).toHaveLength(1);
    expect(http.calls[0].url).toBe(REVOKE_URL);
    expect(http.calls[0].headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(form(http.calls[0])).toEqual({ token: 'rt1', token_type_hint: 'refresh_token', client_id: 'oaiapp_abc' });
  });

  it('retries 5xx and network errors with backoff, then succeeds', async () => {
    const waits = [];
    const http = fakeHttp((_, n) => {
      if (n === 1) return textRes(503, '');
      if (n === 2) throw Object.assign(new Error('down'), { code: 'network' });
      return textRes(200, '');
    });
    expect(await revokeToken(http, { clientId: 'c', refreshToken: 'r', sleep: async (ms) => waits.push(ms) })).toBe(true);
    expect(http.calls).toHaveLength(3);
    expect(waits).toEqual([500, 1500]);
  });

  it('reports false when revocation cannot be confirmed', async () => {
    const down = fakeHttp(() => { throw Object.assign(new Error('down'), { code: 'network' }); });
    expect(await revokeToken(down, { clientId: 'c', refreshToken: 'r', sleep: async () => {} })).toBe(false);
    expect(down.calls).toHaveLength(3); // bounded
    const rejected = fakeHttp(() => textRes(400, { error: 'invalid_request' }));
    expect(await revokeToken(rejected, { clientId: 'c', refreshToken: 'r', sleep: async () => {} })).toBe(false);
    expect(rejected.calls).toHaveLength(1); // a 4xx is not retried
  });
});
