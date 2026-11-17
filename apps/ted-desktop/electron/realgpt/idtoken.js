// SPDX-License-Identifier: MIT
// ID token verification with jose: signature (issuer JWKS), issuer, audience, expiry and the attempt's nonce.

import { createRemoteJWKSet, customFetch, errors, jwtVerify } from 'jose';
import { RgError } from './errors.js';
import { ISSUER, JWKS_URL, safeEqual } from './oauth.js';
import { parseJson, readText } from './wire.js';

// Remote key set whose downloads go through the injected http (host allowlist, no Origin). jose caches the keys
// and reloads them when an unknown `kid` appears.
export function remoteJwks(http) {
  const viaHttp = async (url) => {
    const res = await http.request({
      url: String(url),
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeoutMs: 15_000,
      as: 'text',
    });
    const text = await readText(res);
    return {
      status: res.status,
      json: async () => {
        const jwks = parseJson(text);
        if (!jwks) throw new Error('JWKS is not JSON');
        return jwks;
      },
    };
  };
  return createRemoteJWKSet(new URL(JWKS_URL), { [customFetch]: viaHttp });
}

// -> {subject, email}. `clientId` is the issued client id, `nonce` the value sent with this attempt.
export async function verifyIdToken(idToken, { jwks, clientId, nonce }) {
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, jwks, {
      issuer: ISSUER,
      audience: clientId,
      requiredClaims: ['sub', 'exp', 'iat'],
      clockTolerance: 30,
    }));
  } catch (e) {
    if (e instanceof errors.JWKSTimeout) throw new RgError('timeout');
    if (e instanceof errors.JOSEError) throw new RgError('id_token', e.code);
    throw e; // transport error from the injected http
  }
  if (typeof payload.nonce !== 'string' || !safeEqual(payload.nonce, nonce)) throw new RgError('id_token', 'nonce');
  if (typeof payload.sub !== 'string' || !payload.sub) throw new RgError('id_token', 'sub');
  return { subject: payload.sub, email: typeof payload.email === 'string' ? payload.email : null };
}
