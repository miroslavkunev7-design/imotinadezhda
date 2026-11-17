// SPDX-License-Identifier: MIT
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { remoteJwks, verifyIdToken } from '../../electron/realgpt/idtoken.js';
import { JWKS_URL } from '../../electron/realgpt/oauth.js';

const CLIENT = 'oaiapp_test_client';
const NONCE = 'nonce-123';
let key;
let otherKey;
let publicJwk;
let jwks;

beforeAll(async () => {
  key = await generateKeyPair('RS256');
  otherKey = await generateKeyPair('RS256');
  publicJwk = { ...(await exportJWK(key.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  jwks = createLocalJWKSet({ keys: [publicJwk] });
});

// Locally signed ID token; `claims` and the options override the valid defaults.
function idToken(claims = {}, { signWith = key, exp = '1h', iss = 'https://auth.openai.com', aud = [CLIENT] } = {}) {
  let jwt = new SignJWT({ nonce: NONCE, email: 'user@example.com', sub: 'subject-1', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuedAt()
    .setExpirationTime(exp);
  if (iss) jwt = jwt.setIssuer(iss);
  if (aud) jwt = jwt.setAudience(aud);
  return jwt.sign(signWith.privateKey);
}

const verify = (token, over = {}) => verifyIdToken(token, { jwks, clientId: CLIENT, nonce: NONCE, ...over });

describe('ID token verification', () => {
  it('accepts a valid token and returns the validated identity', async () => {
    expect(await verify(await idToken())).toEqual({ subject: 'subject-1', email: 'user@example.com' });
  });

  it('returns a null email when the claim is absent', async () => {
    expect(await verify(await idToken({ email: undefined }))).toEqual({ subject: 'subject-1', email: null });
  });

  it('rejects a wrong audience (token issued for another client)', async () => {
    await expect(verify(await idToken({}, { aud: ['oaiapp_other'] }))).rejects.toMatchObject({ code: 'id_token' });
    await expect(verify(await idToken(), { clientId: 'dynamic_agent_client' })).rejects.toMatchObject({ code: 'id_token' });
  });

  it('rejects a wrong issuer', async () => {
    await expect(verify(await idToken({}, { iss: 'https://evil.example' }))).rejects.toMatchObject({ code: 'id_token' });
  });

  it('rejects a wrong or missing nonce', async () => {
    await expect(verify(await idToken({ nonce: 'someone-else' }))).rejects.toMatchObject({ code: 'id_token' });
    await expect(verify(await idToken({ nonce: undefined }))).rejects.toMatchObject({ code: 'id_token' });
  });

  it('rejects an expired token', async () => {
    const expired = await idToken({}, { exp: Math.floor(Date.now() / 1000) - 3600 });
    await expect(verify(expired)).rejects.toMatchObject({ code: 'id_token' });
  });

  it('rejects a token without a subject', async () => {
    await expect(verify(await idToken({ sub: undefined }))).rejects.toMatchObject({ code: 'id_token' });
  });

  it('rejects a signature made with another key and an unsigned token', async () => {
    await expect(verify(await idToken({}, { signWith: otherKey }))).rejects.toMatchObject({ code: 'id_token' });
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64({ alg: 'none' })}.${b64({ iss: 'https://auth.openai.com', aud: CLIENT, sub: 's', nonce: NONCE, iat: now, exp: now + 600 })}.`;
    await expect(verify(unsigned)).rejects.toMatchObject({ code: 'id_token' });
  });

  it('error messages are Bulgarian and carry no token text', async () => {
    const token = await idToken({}, { iss: 'https://evil.example' });
    const err = await verify(token).catch((e) => e);
    expect(err.message).toMatch(/^Самоличността от ChatGPT/);
    expect(err.message).not.toContain(token.slice(0, 20));
  });
});

describe('remote JWKS through the injected http', () => {
  it('downloads the keys with http.request from the issuer JWKS URL and verifies with them', async () => {
    const calls = [];
    const http = {
      request: async (opts) => {
        calls.push(opts);
        return { status: 200, ok: true, headers: new Headers(), text: JSON.stringify({ keys: [publicJwk] }) };
      },
    };
    const remote = remoteJwks(http);
    expect(calls).toHaveLength(0); // nothing is fetched before the first verification
    const out = await verifyIdToken(await idToken(), { jwks: remote, clientId: CLIENT, nonce: NONCE });
    expect(out.subject).toBe('subject-1');
    await verifyIdToken(await idToken(), { jwks: remote, clientId: CLIENT, nonce: NONCE });
    expect(calls).toHaveLength(1); // cached
    expect(calls[0]).toMatchObject({ url: JWKS_URL, method: 'GET', as: 'text' });
    expect(JWKS_URL).toBe('https://auth.openai.com/.well-known/jwks.json');
  });

  it('fails as an id_token error when the JWKS endpoint answers with an error', async () => {
    const http = { request: async () => ({ status: 500, ok: false, headers: new Headers(), text: 'oops' }) };
    await expect(verifyIdToken(await idToken(), { jwks: remoteJwks(http), clientId: CLIENT, nonce: NONCE }))
      .rejects.toMatchObject({ code: 'id_token' });
  });

  it('passes a transport error of http through unchanged', async () => {
    const http = { request: async () => { throw Object.assign(new Error('offline'), { code: 'network' }); } };
    await expect(verifyIdToken(await idToken(), { jwks: remoteJwks(http), clientId: CLIENT, nonce: NONCE }))
      .rejects.toMatchObject({ code: 'network' });
  });
});
