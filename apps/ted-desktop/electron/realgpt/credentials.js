// SPDX-License-Identifier: MIT
// Credential record of the connected ChatGPT account (documented field names). It lives only in MAIN, inside the
// encrypted secure store under the name "realgpt-<CRM user id>"; the renderer receives nothing but publicStatus().

import { RgError } from './errors.js';
import { DYNAMIC_CLIENT_ID, ISSUER, PLAN_SCOPE } from './oauth.js';

export const STORE_NAME = 'realgpt';
const DEFAULT_EXPIRES_IN = 3600; // documented access-token lifetime
const REFRESH_SKEW_MS = 5 * 60 * 1000;

const splitScopes = (scope) => String(scope).split(/\s+/).filter(Boolean);

// Token fields are always replaced together. A refresh response without `scope` retains the grant.
function tokenFields(tokens, nowMs, previous) {
  const ttl = Number(tokens.expires_in);
  return {
    access_token: tokens.access_token,
    refresh_token: typeof tokens.refresh_token === 'string' ? tokens.refresh_token : previous?.refresh_token ?? null,
    token_type: tokens.token_type || 'Bearer',
    expires_in: ttl > 0 ? ttl : DEFAULT_EXPIRES_IN,
    scopes: typeof tokens.scope === 'string' ? splitScopes(tokens.scope) : previous?.scopes ?? [],
    saved_at: new Date(nowMs).toISOString(),
    earliest_refresh_at: tokens.earliest_refresh_at ?? null,
  };
}

// Record after a verified sign-in. `identity` comes from the validated ID token.
export function buildRecord({ tokens, identity, clientId, hostId, nowMs }) {
  return {
    email: identity.email,
    issuer: ISSUER,
    subject: identity.subject,
    client_id: clientId,
    ext_agent_host_id: hostId,
    id_token: tokens.id_token,
    ...tokenFields(tokens, nowMs, null),
  };
}

export function applyRefresh(record, tokens, nowMs) {
  return { ...record, ...tokenFields(tokens, nowMs, record) };
}

// Drops the tokens and keeps the registration (issued client id, identity, host id) for the next sign-in.
// The ID token is kept only as a later id_token_hint (terminal refresh); sign-out removes it too.
export function clearTokens(record, { keepIdToken = false } = {}) {
  const kept = {
    email: record.email ?? null,
    issuer: record.issuer ?? ISSUER,
    subject: record.subject ?? null,
    client_id: record.client_id,
    ext_agent_host_id: record.ext_agent_host_id ?? null,
  };
  if (keepIdToken && record.id_token) kept.id_token = record.id_token;
  return kept;
}

function toMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
  if (typeof value !== 'string' || !value.trim()) return 0;
  const n = Number(value);
  if (Number.isFinite(n)) return toMs(n);
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

export function expiresAtMs(record) {
  const saved = Date.parse(record.saved_at);
  return Number.isFinite(saved) ? saved + Number(record.expires_in) * 1000 : 0;
}

// Refresh near expiry, but not before the server's earliest_refresh_at; an expired token is always due.
export function refreshDue(record, nowMs) {
  const exp = expiresAtMs(record);
  if (!(nowMs < exp)) return true;
  return nowMs >= Math.max(exp - REFRESH_SKEW_MS, toMs(record.earliest_refresh_at));
}

export const planEnabled = (record) => Array.isArray(record?.scopes) && record.scopes.includes(PLAN_SCOPE);

// The only view of the credentials that may cross IPC.
export function publicStatus(record) {
  if (!record?.access_token) return { connected: false };
  const status = { connected: true, planEnabled: planEnabled(record) };
  if (record.email) status.email = record.email;
  return status;
}

const usable = (record) =>
  record && typeof record === 'object' && typeof record.client_id === 'string' && record.client_id &&
  record.client_id !== DYNAMIC_CLIENT_ID
    ? record
    : null;

// `owner` binds the record to the signed-in CRM user: a function returning the CRM user id (null when signed out)
// gives every CRM user an own record "realgpt-<id>", so a shared Windows account never hands one broker's ChatGPT
// connection to the next. Without `owner` (unit tests of the module alone) there is one record "realgpt".
// Every method takes an explicit slot, so a flow that started for one user never writes into another user's record.
export function createCredentials(secureStore, owner) {
  const cache = new Map(); // slot -> record (decrypted, MAIN memory only); emptied by forget()
  const slot = () => {
    if (typeof owner !== 'function') return STORE_NAME;
    const id = owner();
    return typeof id === 'string' && id ? `${STORE_NAME}-${id}` : null;
  };
  return {
    slot,
    async load(name = slot()) {
      if (!name) return null;
      if (!cache.has(name)) cache.set(name, usable(await secureStore.read(name)));
      return cache.get(name);
    },
    // The secure store reports "encryption unavailable" by returning false; nothing is ever kept unencrypted.
    async save(record, name = slot()) {
      if (!name) throw new RgError('signed_out');
      let written;
      try {
        written = await secureStore.write(name, record);
      } catch {
        written = false;
      }
      if (written === false) throw new RgError('storage');
      cache.set(name, record);
    },
    async clear(name = slot()) {
      if (!name) return;
      await secureStore.remove(name);
      cache.set(name, null);
    },
    // Drops every decrypted record from memory (CRM sign-out or user change); the encrypted files stay.
    forget() {
      cache.clear();
    },
  };
}
