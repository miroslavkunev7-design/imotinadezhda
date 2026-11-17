// SPDX-License-Identifier: MIT
// Sign in with ChatGPT for open-source local apps: PKCE, authorize URL, loopback callback and token endpoint calls.
// Written from the public documentation; contains no OpenAI DevKit code. Public client: no secret anywhere.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { RgError, serverError } from './errors.js';
import { parseJson, readText, requestIdOf } from './wire.js';

export const ISSUER = 'https://auth.openai.com';
export const AUTHORIZE_URL = `${ISSUER}/api/accounts/authorize`;
export const TOKEN_URL = `${ISSUER}/api/accounts/oauth/token`;
export const REVOKE_URL = `${ISSUER}/api/accounts/oauth/revoke`;
export const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;
export const RESOURCE = 'https://api.openai.com/v1';
export const PLAN_SCOPE = 'chatgpt.tokens.use.direct';
export const SCOPE = `openid profile email offline_access resource.invoke ${PLAN_SCOPE}`;
export const DYNAMIC_CLIENT_ID = 'dynamic_agent_client';
export const AGENT_NAME = 'Ted for Windows';
export const CALLBACK_PATH = '/auth/callback';
export const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

// shell.openExternal on Windows rejects URLs longer than about 2 KB; the optional id_token_hint must fit.
const MAX_URL_LENGTH = 2000;
const TOKEN_TIMEOUT_MS = 30_000;
const TERMINAL_REFRESH_CODES = new Set([
  'invalid_grant',
  'invalid_refresh_token',
  'token_expired',
  'refresh_token_expired',
  'refresh_token_invalidated',
  'refresh_token_reused',
]);

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export const pkceChallenge = (verifier) => createHash('sha256').update(verifier).digest('base64url');

// Constant-time string comparison (digests hide the length difference).
export function safeEqual(a, b) {
  const digest = (s) => createHash('sha256').update(String(s)).digest();
  return timingSafeEqual(digest(a), digest(b));
}

// `clientId` empty = first registration (dynamic client + name hint); otherwise the issued id is reused.
// `consent` asks for the consent screen again (prompt=consent): only when the user wants to enable plan use
// after an earlier grant without it, never on an ordinary sign-in.
export function buildAuthorizeUrl({
  clientId, hostId, redirectUri, state, nonce, challenge, loginHint, idTokenHint, consent,
}) {
  const first = !clientId;
  const params = [
    ['client_id', first ? DYNAMIC_CLIENT_ID : clientId],
    ...(first ? [['agent_name_hint', AGENT_NAME]] : []),
    ['ext_agent_host_id', hostId],
    ...(!first && loginHint ? [['login_hint', loginHint]] : []),
    ...(!first && consent ? [['prompt', 'consent']] : []),
    ['response_type', 'code'],
    ['redirect_uri', redirectUri],
    ['scope', SCOPE],
    ['resource', RESOURCE],
    ['state', state],
    ['nonce', nonce],
    ['code_challenge_method', 'S256'],
    ['code_challenge', challenge],
  ];
  const url = `${AUTHORIZE_URL}?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
  if (first || !idTokenHint) return url;
  const hinted = `${url}&id_token_hint=${encodeURIComponent(idTokenHint)}`;
  return hinted.length <= MAX_URL_LENGTH ? hinted : url;
}

// Static pages only: nothing from the request is ever written into the HTML.
const PAGES = {
  done: 'Входът е завършен. Можете да затворите този раздел и да се върнете в Тед.',
  denied: 'Входът беше отказан. Можете да затворите този раздел.',
  failed: 'Входът не беше завършен. Върнете се в Тед и опитайте отново.',
  invalid: 'Невалидна заявка.',
  used: 'Този вход вече е обработен.',
  notfound: 'Страницата не е намерена.',
  method: 'Методът не е позволен.',
};

function sendPage(res, status, key) {
  const ok = key === 'done';
  const html =
    '<!doctype html><html lang="bg"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Тед за Windows</title>' +
    '<style>body{font:17px/1.5 "Segoe UI",system-ui,sans-serif;background:#f5f2ec;color:#222;margin:0;' +
    'display:grid;place-items:center;min-height:100vh}main{max-width:30em;padding:2em;text-align:center}' +
    `b{display:block;font-size:2.4em;color:${ok ? '#1d7a46' : '#a33'}}</style></head>` +
    `<body><main><b>${ok ? '✓' : '!'}</b><p>${PAGES[key]}</p></main></body></html>`;
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    Connection: 'close',
  });
  res.end(html);
}

// Loopback listener on 127.0.0.1 with an ephemeral port. `callback` resolves once with
// {code, error, clientId} | {timeout:true} | {cancelled:true}. The browser response of the accepted callback is
// held until finish(key), so the page reports the real outcome of the token exchange.
export async function startLoopback({ state, timeoutMs = CALLBACK_TIMEOUT_MS }) {
  // node:http only when a sign-in starts (0.1.5: not at every start of the program).
  const { createServer } = await import('node:http');
  let settle;
  const callback = new Promise((resolve) => {
    settle = resolve;
  });
  let settled = false;
  let held = null;
  let timer = null;

  const server = createServer((req, res) => {
    let url;
    try {
      url = new URL(req.url, 'http://127.0.0.1');
    } catch {
      return sendPage(res, 400, 'invalid');
    }
    if (url.pathname !== CALLBACK_PATH) return sendPage(res, 404, 'notfound');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendPage(res, 405, 'method');
    }
    const q = url.searchParams;
    // A wrong state never ends the attempt: the genuine callback may still arrive.
    if (!safeEqual(q.get('state') ?? '', state)) return sendPage(res, 400, 'invalid');
    if (settled) return sendPage(res, 409, 'used');
    settled = true;
    held = res;
    clearTimeout(timer);
    return settle({ code: q.get('code'), error: q.get('error'), clientId: q.get('client_id') });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  server.on('error', () => {}); // a late listener error must not take the app down; the timeout ends the attempt

  function shutdown() {
    clearTimeout(timer);
    server.close();
    server.closeAllConnections();
  }

  // Ends the attempt: answers the waiting browser tab (if any) and closes the listener.
  function finish(key = 'failed') {
    if (!settled) {
      settled = true;
      settle({ cancelled: true });
    }
    const res = held;
    held = null;
    if (res && !res.writableEnded && !res.destroyed) {
      res.once('close', shutdown);
      sendPage(res, key === 'done' ? 200 : 400, key);
      server.close();
      setTimeout(shutdown, 3000).unref();
    } else {
      shutdown();
    }
  }

  timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    settle({ timeout: true });
    shutdown();
  }, timeoutMs);

  const { address: host, port } = server.address();
  return { host, port, redirectUri: `http://127.0.0.1:${port}${CALLBACK_PATH}`, callback, finish, close: () => finish() };
}

async function postForm(http, url, fields) {
  const res = await http.request({
    url,
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
    timeoutMs: TOKEN_TIMEOUT_MS,
    as: 'text',
  });
  return { status: res.status, body: parseJson(await readText(res)), requestId: requestIdOf(res) };
}

// Authorization-code grant with the issued client id (never the dynamic one). Returns the token response.
export async function exchangeCode(http, { clientId, code, verifier, redirectUri }) {
  const { status, body } = await postForm(http, TOKEN_URL, {
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
    resource: RESOURCE,
  });
  if (status === 200 && typeof body?.access_token === 'string' && typeof body?.id_token === 'string') return body;
  throw new RgError('oauth', serverError(body).code || (status === 200 ? 'непълен отговор' : `HTTP ${status}`));
}

// Refresh grant; `scope` is omitted to retain the grant. Transport errors are thrown by http.
// -> {ok:true, tokens} | {ok:false, status, code, terminal}; terminal = the refresh token is unusable for good.
export async function refreshTokens(http, { clientId, refreshToken }) {
  const { status, body, requestId } = await postForm(http, TOKEN_URL, {
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
    resource: RESOURCE,
  });
  if (status === 200 && typeof body?.access_token === 'string') return { ok: true, tokens: body };
  const { code } = serverError(body);
  return { ok: false, status, code, requestId, terminal: TERMINAL_REFRESH_CODES.has(code) };
}

// Ends the renewable session. An (even empty) HTTP 200 confirms it; network errors and 5xx are retried with backoff.
export async function revokeToken(http, { clientId, refreshToken, sleep, delays = [500, 1500] }) {
  for (let attempt = 0; ; attempt += 1) {
    let status = 0;
    try {
      ({ status } = await postForm(http, REVOKE_URL, {
        token: refreshToken,
        token_type_hint: 'refresh_token',
        client_id: clientId,
      }));
    } catch {
      // transport failure: retried below
    }
    if (status === 200) return true;
    if ((status !== 0 && status < 500) || attempt >= delays.length) return false;
    await sleep(delays[attempt]);
  }
}
