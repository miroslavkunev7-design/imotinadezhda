// SPDX-License-Identifier: MIT
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  STORE_NAME, applyRefresh, buildRecord, clearTokens, createCredentials, expiresAtMs, planEnabled, publicStatus,
  refreshDue,
} from '../../electron/realgpt/credentials.js';
import { HOST_FILE, getHostId } from '../../electron/realgpt/hostid.js';
import { MODELS_URL, pickModels } from '../../electron/realgpt/models.js';

const T0 = Date.parse('2026-01-01T10:00:00.000Z');
const FULL_SCOPE = 'chatgpt.tokens.use.direct email offline_access openid profile resource.invoke';
const tokens = (over = {}) => ({
  access_token: 'at-1', refresh_token: 'rt-1', id_token: 'id-1', token_type: 'Bearer', expires_in: 3600,
  scope: FULL_SCOPE, earliest_refresh_at: null, ...over,
});
const record = (over) => buildRecord({
  tokens: tokens(over), identity: { subject: 'sub-1', email: 'user@example.com' }, clientId: 'oaiapp_abc',
  hostId: 'urn:uuid:11111111-2222-4333-8444-555555555555', nowMs: T0,
});

describe('host id', () => {
  let dir;
  beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'rg-host-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('creates urn:uuid once in realgpt-host.json and reuses it', async () => {
    const nested = path.join(dir, 'data'); // created on demand
    const id = await getHostId(nested);
    expect(id).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await getHostId(nested)).toBe(id);
    expect(HOST_FILE).toBe('realgpt-host.json');
    expect(JSON.parse(await readFile(path.join(nested, HOST_FILE), 'utf8')).ext_agent_host_id).toBe(id);
    expect(await readdir(nested)).toEqual([HOST_FILE]); // no temp file left behind
  });

  it('replaces only an unusable file', async () => {
    await writeFile(path.join(dir, HOST_FILE), '{broken');
    const id = await getHostId(dir);
    expect(id).toMatch(/^urn:uuid:/);
    await writeFile(path.join(dir, HOST_FILE), JSON.stringify({ ext_agent_host_id: 'user@example.com' }));
    const next = await getHostId(dir);
    expect(next).toMatch(/^urn:uuid:/);
    expect(await getHostId(dir)).toBe(next);
  });
});

describe('credential record', () => {
  it('has exactly the documented fields', () => {
    expect(record()).toEqual({
      email: 'user@example.com',
      issuer: 'https://auth.openai.com',
      subject: 'sub-1',
      client_id: 'oaiapp_abc',
      ext_agent_host_id: 'urn:uuid:11111111-2222-4333-8444-555555555555',
      id_token: 'id-1',
      access_token: 'at-1',
      refresh_token: 'rt-1',
      token_type: 'Bearer',
      expires_in: 3600,
      scopes: ['chatgpt.tokens.use.direct', 'email', 'offline_access', 'openid', 'profile', 'resource.invoke'],
      saved_at: '2026-01-01T10:00:00.000Z',
      earliest_refresh_at: null,
    });
  });

  it('plan usage is enabled only when chatgpt.tokens.use.direct was granted', () => {
    expect(planEnabled(record())).toBe(true);
    expect(planEnabled(record({ scope: 'openid profile email offline_access resource.invoke' }))).toBe(false);
    expect(planEnabled(record({ scope: undefined }))).toBe(false);
    expect(planEnabled(null)).toBe(false);
  });

  it('exposes only connected, email and planEnabled', () => {
    expect(publicStatus(record())).toEqual({ connected: true, email: 'user@example.com', planEnabled: true });
    expect(publicStatus(record({ scope: 'openid' }))).toEqual({ connected: true, email: 'user@example.com', planEnabled: false });
    expect(publicStatus(null)).toEqual({ connected: false });
    expect(publicStatus(clearTokens(record()))).toEqual({ connected: false });
  });

  it('rotation replaces access token, refresh token, expiry and scopes together', () => {
    const later = T0 + 50 * 60 * 1000;
    const next = applyRefresh(record(), { access_token: 'at-2', refresh_token: 'rt-2', expires_in: 1800, scope: 'openid email' }, later);
    expect(next).toMatchObject({
      access_token: 'at-2', refresh_token: 'rt-2', expires_in: 1800, scopes: ['openid', 'email'],
      saved_at: new Date(later).toISOString(), client_id: 'oaiapp_abc', subject: 'sub-1', id_token: 'id-1',
    });
    // A response without scope retains the grant; without a new refresh token the old one stays.
    const kept = applyRefresh(record(), { access_token: 'at-3' }, later);
    expect(kept.scopes).toEqual(record().scopes);
    expect(kept.refresh_token).toBe('rt-1');
    expect(kept.expires_in).toBe(3600);
  });

  it('clearing tokens keeps the registration and the host id', () => {
    const base = { email: 'user@example.com', issuer: 'https://auth.openai.com', subject: 'sub-1', client_id: 'oaiapp_abc', ext_agent_host_id: 'urn:uuid:11111111-2222-4333-8444-555555555555' };
    expect(clearTokens(record())).toEqual(base);
    expect(clearTokens(record(), { keepIdToken: true })).toEqual({ ...base, id_token: 'id-1' });
  });

  it('refresh is due near expiry, never before earliest_refresh_at, always after expiry', () => {
    const min = 60 * 1000;
    expect(expiresAtMs(record())).toBe(T0 + 60 * min);
    expect(refreshDue(record(), T0 + 10 * min)).toBe(false);
    expect(refreshDue(record(), T0 + 54 * min)).toBe(false);
    expect(refreshDue(record(), T0 + 56 * min)).toBe(true);
    expect(refreshDue(record(), T0 + 61 * min)).toBe(true);
    const lateSeconds = record({ earliest_refresh_at: (T0 + 58 * min) / 1000 }); // unix seconds
    expect(refreshDue(lateSeconds, T0 + 56 * min)).toBe(false);
    expect(refreshDue(lateSeconds, T0 + 58 * min)).toBe(true);
    const lateIso = record({ earliest_refresh_at: new Date(T0 + 70 * min).toISOString() });
    expect(refreshDue(lateIso, T0 + 59 * min)).toBe(false);
    expect(refreshDue(lateIso, T0 + 60 * min)).toBe(true); // expired wins
    expect(refreshDue({ ...record(), saved_at: 'garbage' }, T0)).toBe(true);
  });
});

describe('credential store', () => {
  function memoryStore(initial) {
    const map = new Map(initial ? [[STORE_NAME, initial]] : []);
    const log = [];
    return {
      map, log,
      available: () => true,
      read: (name) => { log.push(['read', name]); return map.get(name) ?? null; },
      write: (name, value) => { log.push(['write', name]); map.set(name, value); },
      remove: (name) => { log.push(['remove', name]); map.delete(name); },
    };
  }

  it('uses the secure store name "realgpt" and reads it once', async () => {
    const store = memoryStore(record());
    const creds = createCredentials(store);
    expect((await creds.load()).client_id).toBe('oaiapp_abc');
    await creds.load();
    expect(store.log).toEqual([['read', 'realgpt']]);
    await creds.save(clearTokens(record()));
    expect(store.map.get('realgpt').access_token).toBeUndefined();
    await creds.clear();
    expect(store.map.has('realgpt')).toBe(false);
    expect(await creds.load()).toBeNull();
  });

  it('ignores a record without an issued client id', async () => {
    for (const bad of [{ access_token: 'x' }, { client_id: 'dynamic_agent_client', access_token: 'x' }, 'text', 7]) {
      expect(await createCredentials(memoryStore(bad)).load()).toBeNull();
    }
  });
});

describe('models', () => {
  it('keeps visibility "list" in server order and maps to slug + displayName', () => {
    expect(MODELS_URL).toBe('https://api.openai.com/v1/models');
    const body = {
      models: [
        { slug: 'model-b', display_name: 'Model B', visibility: 'list', extra: 1 },
        { slug: 'model-hidden', display_name: 'Hidden', visibility: 'hide' },
        { slug: 'model-a', visibility: 'list' },
        { display_name: 'No slug', visibility: 'list' },
        null,
        { slug: 'model-none', display_name: 'No visibility' },
      ],
    };
    expect(pickModels(body)).toEqual([
      { slug: 'model-b', displayName: 'Model B' },
      { slug: 'model-a', displayName: 'model-a' },
    ]);
  });

  it('returns null for a body that is not the documented shape', () => {
    expect(pickModels({ object: 'list', data: [{ id: 'x' }] })).toBeNull();
    expect(pickModels(null)).toBeNull();
    expect(pickModels({ models: [] })).toEqual([]);
  });
});
