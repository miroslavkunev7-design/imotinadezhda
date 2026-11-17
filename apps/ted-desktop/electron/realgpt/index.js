// SPDX-License-Identifier: MIT
// Real GPT: "Sign in with ChatGPT" for open-source local apps and inference on the user's ChatGPT plan.
// MAIN process only. Tokens never leave this module; the renderer sees RgStatus, model names and answer text.

import { applyRefresh, buildRecord, clearTokens, createCredentials, expiresAtMs, planEnabled, publicStatus, refreshDue } from './credentials.js';
import { RgError, fail, mapApiError, toFailure } from './errors.js';
import { getHostId } from './hostid.js';
import { remoteJwks, verifyIdToken } from './idtoken.js';
import { MODELS_URL, pickModels } from './models.js';
import {
  CALLBACK_TIMEOUT_MS, DYNAMIC_CLIENT_ID, buildAuthorizeUrl, exchangeCode, pkceChallenge, randomToken, refreshTokens,
  revokeToken, startLoopback,
} from './oauth.js';
import { RESPONSES_URL, buildRequest, consumeStream, rejectsEffort, resultOf, withoutReasoning } from './responses.js';
import { discard, parseJson, readText, requestIdOf } from './wire.js';

const noop = () => {};
// Upper bound handed to http for a streaming request; the real guards are the header and idle timers below.
const STREAM_HTTP_TIMEOUT_MS = 30 * 60 * 1000;

export function createRealGpt({
  http,
  secureStore,
  dataDir,
  openExternal,
  log = { info: noop, warn: noop, error: noop },
  emit = noop,
  // Test seams; production uses the defaults.
  jwks = remoteJwks(http),
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  signInTimeoutMs = CALLBACK_TIMEOUT_MS,
  headersTimeoutMs = 60_000,
  idleTimeoutMs = 5 * 60 * 1000,
  deltaIntervalMs = 30,
}) {
  const creds = createCredentials(secureStore);
  const active = new Map(); // requestId -> {ctl, why, text}
  const noEffort = new Set(); // models for which the route rejected reasoning.effort in this session
  let pending = null; // current sign-in attempt
  let refreshing = null; // single-flight refresh promise
  let hostIdPromise = null;

  const hostId = () => (hostIdPromise ??= getHostId(dataDir).catch((e) => {
    hostIdPromise = null;
    throw e;
  }));

  async function load() {
    try {
      return await creds.load();
    } catch (e) {
      log.error('realgpt.store_read_failed', { error: String(e?.message || e) });
      return null;
    }
  }

  async function status() {
    return publicStatus(await load());
  }

  // ---- sign-in ---------------------------------------------------------------------------------------------

  function cancelSignIn() {
    const attempt = pending;
    pending = null;
    attempt?.loop?.close();
    return { ok: true };
  }

  // `newAccount` starts a fresh registration (dynamic client) instead of reusing the saved issued client id.
  async function signIn({ newAccount = false } = {}) {
    cancelSignIn(); // a new attempt replaces an unfinished one
    const attempt = { loop: null };
    pending = attempt;
    const alive = () => {
      if (pending !== attempt) throw new RgError('cancelled');
    };
    let pageKey = 'failed';
    let issuedForNew = null;
    let saved = null;
    let host = null;
    try {
      if (!(await secureStore.available())) throw new RgError('storage');
      host = await hostId();
      saved = newAccount ? null : await load();
      alive();

      const state = randomToken();
      const nonce = randomToken();
      const verifier = randomToken();
      attempt.loop = await startLoopback({ state, timeoutMs: signInTimeoutMs });
      alive();
      const { redirectUri } = attempt.loop;
      const url = buildAuthorizeUrl({
        clientId: saved?.client_id,
        hostId: host,
        redirectUri,
        state,
        nonce,
        challenge: pkceChallenge(verifier),
        loginHint: saved?.email,
        idTokenHint: saved?.id_token,
      });
      let opened;
      try {
        opened = await openExternal(url);
      } catch {
        throw new RgError('browser');
      }
      if (opened && opened.ok === false) throw new RgError('browser');
      log.info('realgpt.signin_started', { registration: saved ? 'saved' : 'new' });

      const cb = await attempt.loop.callback;
      if (cb.cancelled) throw new RgError('cancelled');
      if (cb.timeout) throw new RgError('signin_timeout');
      if (cb.error) {
        if (cb.error === 'access_denied') pageKey = 'denied';
        throw new RgError(cb.error === 'access_denied' ? 'access_denied' : 'oauth', cb.error);
      }
      if (!cb.code) throw new RgError('oauth', 'missing code');

      let clientId;
      if (saved) {
        // Re-authorisation may omit client_id; a different one must never replace the saved registration.
        if (cb.clientId && cb.clientId !== saved.client_id) throw new RgError('oauth', 'client mismatch');
        clientId = saved.client_id;
      } else {
        if (!cb.clientId || cb.clientId === DYNAMIC_CLIENT_ID || !/^[\w.:-]{1,200}$/.test(cb.clientId)) {
          throw new RgError('registration');
        }
        clientId = cb.clientId;
        issuedForNew = clientId;
      }

      const tokens = await exchangeCode(http, { clientId, code: cb.code, verifier, redirectUri });
      alive();
      const identity = await verifyIdToken(tokens.id_token, { jwks, clientId, nonce });
      if (saved?.subject && saved.subject !== identity.subject) throw new RgError('account_mismatch');
      alive();

      const record = buildRecord({ tokens, identity, clientId, hostId: host, nowMs: now() });
      await creds.save(record);
      pageKey = 'done';
      log.info('realgpt.signin_done', { planEnabled: planEnabled(record) });
      return { ok: true, status: publicStatus(record) };
    } catch (e) {
      // A registration that was issued but not completed is kept, so the next attempt does not create another.
      if (issuedForNew && !(await load()) && !(e instanceof RgError && e.code === 'storage')) {
        await creds.save({ client_id: issuedForNew, ext_agent_host_id: host }).catch(noop);
      }
      const out = toFailure(e);
      log.warn('realgpt.signin_failed', { code: out.code, error: out.code === 'internal' ? String(e?.message || e) : undefined });
      return out;
    } finally {
      attempt.loop?.finish(pageKey);
      if (pending === attempt) pending = null;
    }
  }

  // ---- tokens ----------------------------------------------------------------------------------------------

  async function doRefresh() {
    const before = await load();
    if (!before?.refresh_token) throw new RgError('reauth');
    const out = await refreshTokens(http, { clientId: before.client_id, refreshToken: before.refresh_token });
    const current = await load();
    // Signed out or replaced while the request was in flight: the result belongs to nobody.
    if (current?.refresh_token !== before.refresh_token) throw new RgError('not_connected');
    if (out.ok) {
      const next = applyRefresh(current, out.tokens, now());
      await creds.save(next);
      return next;
    }
    log.warn('realgpt.refresh_failed', { status: out.status, code: out.code, requestId: out.requestId });
    if (out.terminal) {
      await creds.save(clearTokens(current, { keepIdToken: true }));
      throw new RgError('reauth');
    }
    // Anything else (invalid_client, 5xx, ...) keeps the credentials: it is not proof that the session is gone.
    if (out.code === 'invalid_client') throw new RgError('config', out.code);
    const { code, detail } = mapApiError(out.status, { error: out.code });
    throw new RgError(code, detail);
  }

  // Refresh tokens rotate, so concurrent callers share one request.
  function refresh() {
    refreshing ??= doRefresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function accessToken() {
    const record = await load();
    if (!record?.access_token) throw new RgError('not_connected');
    if (!refreshDue(record, now())) return record.access_token;
    if (!record.refresh_token) {
      // Nothing to renew with: usable until it expires, then only a new sign-in helps.
      if (now() < expiresAtMs(record)) return record.access_token;
      await creds.save(clearTokens(record, { keepIdToken: true }));
      throw new RgError('reauth');
    }
    try {
      return (await refresh()).access_token;
    } catch (e) {
      // A temporary failure must not block a token that is still valid.
      if (!(e instanceof RgError && (e.code === 'reauth' || e.code === 'not_connected')) && now() < expiresAtMs(record)) {
        return record.access_token;
      }
      throw e;
    }
  }

  // Runs request(token); on HTTP 401 refreshes once and retries once.
  async function authed(request) {
    const token = await accessToken();
    const res = await request(token);
    if (res.status !== 401) return res;
    await discard(res);
    const current = await load();
    const fresh = current?.access_token && current.access_token !== token ? current.access_token : (await refresh()).access_token;
    return request(fresh);
  }

  async function usableRecord() {
    const record = await load();
    if (!record?.access_token) throw new RgError('not_connected');
    if (!planEnabled(record)) throw new RgError('plan_disabled');
    return record;
  }

  // ---- sign-out --------------------------------------------------------------------------------------------

  async function signOut() {
    cancelSignIn();
    for (const job of active.values()) abortJob(job, 'cancel');
    if (refreshing) await refreshing.catch(noop); // revoke the latest rotation, not a stale token
    const record = await load();
    let revoked = false;
    if (record?.refresh_token) {
      revoked = await revokeToken(http, { clientId: record.client_id, refreshToken: record.refresh_token, sleep });
    }
    if (record) {
      try {
        await creds.save(clearTokens(record));
      } catch {
        try {
          await creds.clear(); // the tokens must not stay behind, even if the registration is lost with them
        } catch {
          return fail('storage', null, { revoked });
        }
      }
    }
    log.info('realgpt.signout', { revoked });
    return { ok: true, revoked };
  }

  // ---- models ----------------------------------------------------------------------------------------------

  async function models() {
    try {
      await usableRecord();
      const res = await authed((token) => http.request({
        url: MODELS_URL,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        timeoutMs: 30_000,
        as: 'text',
      }));
      const body = parseJson(await readText(res));
      if (res.status !== 200) {
        const mapped = mapApiError(res.status, body);
        log.warn('realgpt.models_failed', { status: res.status, code: mapped.serverCode, requestId: requestIdOf(res) });
        return fail(mapped.code, mapped.detail);
      }
      const list = pickModels(body);
      return list ? { ok: true, models: list } : fail('http', 'неочакван отговор');
    } catch (e) {
      return toFailure(e);
    }
  }

  // ---- inference -------------------------------------------------------------------------------------------

  function abortJob(job, why) {
    job.why ??= why;
    job.ctl.abort();
  }

  async function guarded(job, ms, fn) {
    const timer = setTimeout(() => abortJob(job, 'timeout'), ms);
    try {
      return await fn();
    } finally {
      clearTimeout(timer);
    }
  }

  // Coalesces deltas so the renderer gets at most one update per interval; `text` is always the full answer so far.
  function deltaSink(requestId) {
    let text = '';
    let queued = '';
    let timer = null;
    let last = 0;
    const flush = () => {
      clearTimeout(timer);
      timer = null;
      if (!queued) return;
      const delta = queued;
      queued = '';
      last = Date.now();
      try {
        emit('realgpt:delta', { requestId, delta, text });
      } catch {
        // the window may be gone; the stream result is still returned
      }
    };
    return {
      push(delta, full) {
        text = full;
        queued += delta;
        if (Date.now() - last >= deltaIntervalMs) flush();
        else timer ??= setTimeout(flush, deltaIntervalMs);
      },
      flush,
    };
  }

  // Opens the stream; a non-2xx answer comes back with its parsed error body.
  async function openStream(body, job) {
    const res = await authed((token) => guarded(job, headersTimeoutMs, () => http.request({
      url: RESPONSES_URL,
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal: job.ctl.signal,
      timeoutMs: STREAM_HTTP_TIMEOUT_MS,
      as: 'stream',
    })));
    const ok = res.status >= 200 && res.status < 300;
    const error = ok ? null : parseJson(await guarded(job, headersTimeoutMs, () => readText(res, job.ctl.signal)));
    return { res, ok, error };
  }

  async function runSend(requestId, firstBody, job) {
    await usableRecord();
    let body = firstBody;
    let effortIgnored = false;
    if (body.reasoning && noEffort.has(body.model)) {
      body = withoutReasoning(body);
      effortIgnored = true;
    }
    let opened = await openStream(body, job);
    // The one corrective retry: the route named reasoning as unsupported, so it is removed (never the same body).
    if (opened.res.status === 400 && body.reasoning && rejectsEffort(opened.error)) {
      noEffort.add(body.model);
      body = withoutReasoning(body);
      effortIgnored = true;
      opened = await openStream(body, job);
    }
    const { res } = opened;
    if (!opened.ok) {
      const mapped = mapApiError(res.status, opened.error);
      log.warn('realgpt.send_rejected', { requestId, status: res.status, code: mapped.serverCode, param: mapped.param, serverRequestId: requestIdOf(res) });
      return fail(mapped.code, mapped.detail);
    }

    const sink = deltaSink(requestId);
    let idle = null;
    const arm = () => {
      clearTimeout(idle);
      idle = setTimeout(() => abortJob(job, 'timeout'), idleTimeoutMs);
    };
    arm();
    let outcome;
    try {
      outcome = await consumeStream(res.body, {
        signal: job.ctl.signal,
        onActivity: arm,
        onDelta: (delta, full) => {
          job.text = full;
          sink.push(delta, full);
        },
      });
    } finally {
      clearTimeout(idle);
      sink.flush();
    }
    if (outcome.kind !== 'completed' && job.why) throw new RgError('aborted'); // mapped by send() from job.why
    if (outcome.kind !== 'completed') {
      log.warn('realgpt.send_unfinished', { requestId, kind: outcome.kind, code: outcome.error?.code, reason: outcome.reason, serverRequestId: requestIdOf(res) });
    }
    const result = resultOf(outcome, body.model);
    if (result.ok && effortIgnored) result.effortIgnored = true;
    return result;
  }

  async function send(args) {
    const requestId = args?.requestId;
    if (typeof requestId !== 'string' || !requestId || requestId.length > 128 || active.has(requestId)) {
      return fail('invalid', 'requestId');
    }
    let body;
    try {
      body = buildRequest(args);
    } catch (e) {
      return toFailure(e);
    }
    const job = { ctl: new AbortController(), why: null, text: '' };
    active.set(requestId, job);
    const started = now();
    let result;
    try {
      result = await runSend(requestId, body, job);
    } catch (e) {
      const partial = job.text ? { text: job.text } : undefined;
      if (job.why) result = fail(job.why === 'cancel' ? 'aborted' : 'timeout', null, partial);
      else {
        result = toFailure(e, partial);
        if (result.code === 'internal') log.error('realgpt.send_error', { requestId, error: String(e?.message || e) });
      }
    } finally {
      active.delete(requestId);
    }
    log.info('realgpt.send', { requestId, model: body.model, ok: result.ok, code: result.code, ms: now() - started });
    return result;
  }

  function cancel(requestId) {
    const job = active.get(requestId);
    if (job) abortJob(job, 'cancel');
    return { ok: true };
  }

  return { status, signIn, cancelSignIn, signOut, models, send, cancel };
}
