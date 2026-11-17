// SPDX-License-Identifier: MIT
// Real GPT: "Sign in with ChatGPT" for open-source local apps and inference on the user's ChatGPT plan.
// MAIN process only. Tokens never leave this module; the renderer sees RgStatus, model names and answer text.

import {
  applyRefresh, buildRecord, clearTokens, createCredentials, expiresAtMs, planEnabled, publicStatus, refreshDue,
} from './credentials.js';
import { RgError, fail, mapApiError, toFailure } from './errors.js';
import { getHostId } from './hostid.js';
import { remoteJwks, verifyIdToken } from './idtoken.js';
import { MODELS_URL, pickModels } from './models.js';
import {
  CALLBACK_TIMEOUT_MS, DYNAMIC_CLIENT_ID, buildAuthorizeUrl, exchangeCode, pkceChallenge, randomToken, refreshTokens,
  revokeToken, startLoopback,
} from './oauth.js';
import { EFFORTS, RESPONSES_URL, buildRequest, consumeStream, rejectsEffort, resultOf, withoutReasoning } from './responses.js';
import { discard, parseJson, readText, requestIdOf } from './wire.js';

const noop = () => {};
// The only host that may receive a ChatGPT access token (CRM hosts never do).
export const API_HOST = 'api.openai.com';

export function assertApiUrl(url) {
  let u = null;
  try {
    u = new URL(String(url));
  } catch {
    u = null;
  }
  if (!u || u.protocol !== 'https:' || u.port !== '' || u.hostname !== API_HOST) throw new RgError('host');
  return u;
}

// Bearer request to the OpenAI API; the host is checked on every call, before anything is sent.
export function bearerRequest(http, token, opts) {
  assertApiUrl(opts?.url);
  return http.request({ ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` } });
}
// Upper bound handed to http for a streaming request; the real guards are the header and idle timers below.
const STREAM_HTTP_TIMEOUT_MS = 30 * 60 * 1000;

// Text-only requests (no consent for tools): attached file ids are not resolved; the model sees only their count.
function textMessages(messages) {
  if (!Array.isArray(messages)) return messages;
  return messages.map((m) => {
    if (!m || typeof m !== 'object' || !Array.isArray(m.files) || !m.files.length) {
      return m && typeof m === 'object' && 'files' in m ? { role: m.role, text: m.text, ...(m.images ? { images: m.images } : {}) } : m;
    }
    const note = `[${m.files.length === 1 ? 'Прикачен файл' : `Прикачени файлове: ${m.files.length}`} – в режим „само текст“ Real GPT не чете файлове; ползвай Тед (сървъра) или разреши инструментите.]`;
    return { role: m.role, text: [m.text, note].filter((x) => x && String(x).trim()).join('\n'), ...(m.images ? { images: m.images } : {}) };
  });
}

export function createRealGpt({
  http,
  secureStore,
  dataDir,
  openExternal,
  // Signed-in CRM user id (null when signed out). Production always passes it: the connection belongs to that user.
  owner,
  log = { info: noop, warn: noop, error: noop },
  emit = noop,
  // The tool loop of docs/CONTRACT.md §9 (electron/agent/loop.js). Without it (or without the employee's consent
  // "all") every request is the text-only request of 0.1.2.
  agent = null,
  // Test seams; production uses the defaults.
  jwks = remoteJwks(http),
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  signInTimeoutMs = CALLBACK_TIMEOUT_MS,
  headersTimeoutMs = 60_000,
  idleTimeoutMs = 5 * 60 * 1000,
  deltaIntervalMs = 30,
}) {
  const creds = createCredentials(secureStore, owner);
  const active = new Map(); // requestId -> {ctl, why, text}
  const noEffort = new Set(); // models for which the route rejected reasoning.effort in this session
  let pending = null; // current sign-in attempt
  let refreshing = null; // single-flight refresh promise
  let hostIdPromise = null;

  const hostId = () => (hostIdPromise ??= getHostId(dataDir).catch((e) => {
    hostIdPromise = null;
    throw e;
  }));

  async function load(slot) {
    try {
      return await creds.load(slot);
    } catch (e) {
      log.error('realgpt.store_read_failed', { error: String(e?.message || e) });
      return null;
    }
  }

  async function status() {
    return publicStatus(await load());
  }

  // ---- consent (CONTRACT §8.2/§8.4): per CRM user and per ChatGPT account, only in MAIN's secure store --------

  const consentName = () => {
    const slot = creds.slot();
    return slot ? slot.replace(/^realgpt/, 'realgpt-consent') : null;
  };

  async function consentState() {
    const name = consentName();
    const record = name ? await load() : null;
    if (!record?.access_token || !record.subject) return { consent: null, account: record?.email };
    let saved = null;
    try {
      saved = await secureStore.read(name);
    } catch {
      saved = null;
    }
    const value = saved?.bySubject?.[record.subject];
    return { consent: value === 'all' || value === 'text' ? value : null, account: record.email };
  }

  async function consent() {
    const st = await consentState();
    return { ok: true, consent: st.consent, ...(st.account ? { account: st.account } : {}) };
  }

  // choice "all" | "text"; null removes the choice for this account (Настройки → Контрол на данните).
  async function setConsent(choice) {
    if (choice !== 'all' && choice !== 'text' && choice !== null) return fail('invalid', 'consent');
    const name = consentName();
    if (!name) return fail('signed_out');
    const record = await load();
    if (!record?.access_token || !record.subject) return fail('not_connected');
    let saved = null;
    try {
      saved = await secureStore.read(name);
    } catch {
      saved = null;
    }
    const bySubject = { ...(saved?.bySubject || {}) };
    if (choice === null) delete bySubject[record.subject];
    else bySubject[record.subject] = choice;
    let written;
    try {
      written = await secureStore.write(name, { v: 1, bySubject });
    } catch {
      written = false;
    }
    if (written === false) return fail('storage');
    log.info('realgpt.consent', { consent: choice || 'reset' });
    return { ok: true, consent: choice };
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
    const slot = creds.slot(); // the CRM user this sign-in belongs to, fixed for the whole attempt
    try {
      if (!slot) throw new RgError('signed_out');
      if (!(await secureStore.available())) throw new RgError('storage');
      host = await hostId();
      saved = newAccount ? null : await load(slot);
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
        // Signed in but plan use was not granted: this sign-in is the user's request to enable it.
        consent: Boolean(saved?.access_token) && !planEnabled(saved),
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
      await creds.save(record, slot);
      pageKey = 'done';
      log.info('realgpt.signin_done', { planEnabled: planEnabled(record) });
      return { ok: true, status: publicStatus(record) };
    } catch (e) {
      // A registration that was issued but not completed is kept, so the next attempt does not create another.
      if (issuedForNew && slot && !(await load(slot)) && !(e instanceof RgError && e.code === 'storage')) {
        await creds.save({ client_id: issuedForNew, ext_agent_host_id: host }, slot).catch(noop);
      }
      const out = toFailure(e);
      const error = out.code === 'internal' ? String(e?.message || e) : undefined;
      log.warn('realgpt.signin_failed', { code: out.code, error });
      return out;
    } finally {
      attempt.loop?.finish(pageKey);
      if (pending === attempt) pending = null;
    }
  }

  // ---- tokens ----------------------------------------------------------------------------------------------

  async function doRefresh() {
    const slot = creds.slot();
    const before = await load(slot);
    if (!before?.refresh_token) throw new RgError('reauth');
    const out = await refreshTokens(http, { clientId: before.client_id, refreshToken: before.refresh_token });
    const current = await load(slot);
    // Signed out or replaced while the request was in flight: the result belongs to nobody.
    if (current?.refresh_token !== before.refresh_token) throw new RgError('not_connected');
    if (out.ok) {
      const next = applyRefresh(current, out.tokens, now());
      await creds.save(next, slot);
      return next;
    }
    log.warn('realgpt.refresh_failed', { status: out.status, code: out.code, requestId: out.requestId });
    if (out.terminal) {
      await creds.save(clearTokens(current, { keepIdToken: true }), slot);
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
    const slot = creds.slot();
    const record = await load(slot);
    if (!record?.access_token) throw new RgError('not_connected');
    if (!refreshDue(record, now())) return record.access_token;
    if (!record.refresh_token) {
      // Nothing to renew with: usable until it expires, then only a new sign-in helps.
      if (now() < expiresAtMs(record)) return record.access_token;
      await creds.save(clearTokens(record, { keepIdToken: true }), slot);
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
    // Another caller may have rotated the tokens already; then its result is used instead of a second refresh.
    const current = await load();
    const rotated = current?.access_token && current.access_token !== token;
    return request(rotated ? current.access_token : (await refresh()).access_token);
  }

  async function usableRecord() {
    if (!creds.slot()) throw new RgError('signed_out');
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
    const slot = creds.slot();
    if (!slot) return { ok: true, revoked: false }; // no CRM user: there is no connection to remove
    const record = await load(slot);
    let revoked = false;
    if (record?.refresh_token) {
      revoked = await revokeToken(http, { clientId: record.client_id, refreshToken: record.refresh_token, sleep });
    }
    if (record) {
      try {
        await creds.save(clearTokens(record), slot);
      } catch {
        try {
          await creds.clear(slot); // the tokens must not stay behind, even if the registration is lost with them
        } catch {
          return fail('storage', null, { revoked });
        }
      }
    }
    log.info('realgpt.signout', { revoked });
    return { ok: true, revoked };
  }

  // CRM sign-out, session expiry or another CRM user: stop everything of the previous user and drop the
  // decrypted credentials from memory. The encrypted record stays for that user's next CRM sign-in.
  function detach() {
    cancelSignIn();
    for (const job of active.values()) abortJob(job, 'cancel');
    creds.forget();
    return { ok: true };
  }

  // ---- models ----------------------------------------------------------------------------------------------

  async function models() {
    try {
      await usableRecord();
      const res = await authed((token) => bearerRequest(http, token, {
        url: MODELS_URL,
        method: 'GET',
        headers: { Accept: 'application/json' },
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
    const res = await authed((token) => guarded(job, headersTimeoutMs, () => bearerRequest(http, token, {
      url: RESPONSES_URL,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal: job.ctl.signal,
      timeoutMs: STREAM_HTTP_TIMEOUT_MS,
      as: 'stream',
    })));
    const ok = res.status >= 200 && res.status < 300;
    const error = ok ? null : parseJson(await guarded(job, headersTimeoutMs, () => readText(res, job.ctl.signal)));
    if (job.why) throw new RgError('aborted'); // send() reports the real reason from job.why
    return { res, ok, error };
  }

  // One streamed request of the agent loop: -> {ok:true, outcome} | {ok:false, status, error}. `prefix` is the
  // text of the earlier rounds, so realgpt:delta always carries the whole answer so far.
  async function streamOnce(requestId, body, job, prefix = '') {
    const opened = await openStream(body, job);
    if (!opened.ok) {
      const mapped = mapApiError(opened.res.status, opened.error);
      log.warn('realgpt.round_rejected', {
        requestId, status: opened.res.status, code: mapped.serverCode, param: mapped.param, serverRequestId: requestIdOf(opened.res),
      });
      return { ok: false, status: opened.res.status, error: opened.error };
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
      outcome = await consumeStream(opened.res.body, {
        signal: job.ctl.signal,
        onActivity: arm,
        onDelta: (delta, full) => {
          job.text = prefix + full;
          sink.push(delta, prefix + full);
        },
      });
    } finally {
      clearTimeout(idle);
      sink.flush();
    }
    if (outcome.kind !== 'completed' && job.why) throw new RgError('aborted');
    if (outcome.kind !== 'completed') {
      log.warn('realgpt.round_unfinished', { requestId, kind: outcome.kind, code: outcome.error?.code, reason: outcome.reason });
    }
    return { ok: true, outcome };
  }

  async function runAgent(requestId, args, job) {
    await usableRecord();
    if (typeof args.model !== 'string' || !/^[\w.:-]{1,100}$/.test(args.model)) throw new RgError('invalid', 'model');
    if (args.effort != null && !EFFORTS.includes(args.effort)) throw new RgError('invalid', 'effort');
    const model = args.model;
    const effort = args.effort != null && noEffort.has(model) ? undefined : args.effort;
    const result = await agent.run({
      requestId, model, effort, messages: args.messages, mode: args.mode, hints: args.hints, canvas: args.canvas,
      caseId: args.caseId, role: args.role, custom: args.instructions, nick: args.nick, chatId: args.chatId,
      temporary: args.temporary, signal: job.ctl.signal,
      stream: (body, prefix) => streamOnce(requestId, body, job, prefix),
      emit: (event) => emit('realgpt:event', { requestId, ...event }),
    });
    if (result && result.ok && args.effort != null && effort === undefined) result.effortIgnored = true;
    if (result && !result.ok && job.why) return { ...result, ...fail(job.why === 'cancel' ? 'aborted' : 'timeout') };
    return result;
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
      // Direct-route admission may answer {detail:"..."}: diagnostic text only, kept for the log.
      const detail = typeof opened.error?.detail === 'string' ? opened.error.detail.slice(0, 200) : undefined;
      log.warn('realgpt.send_rejected', {
        requestId, status: res.status, code: mapped.serverCode, param: mapped.param, detail, serverRequestId: requestIdOf(res),
      });
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
    if (outcome.kind !== 'completed' && job.why) throw new RgError('aborted');
    if (outcome.kind !== 'completed') {
      log.warn('realgpt.send_unfinished', {
        requestId, kind: outcome.kind, code: outcome.error?.code, reason: outcome.reason, serverRequestId: requestIdOf(res),
      });
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
    // MAIN reads the stored consent itself: without "all" the request is exactly the text-only one of 0.1.2.
    const useAgent = !!agent && (await consentState()).consent === 'all';
    let body;
    try {
      // Validates model, effort, instructions and messages the same way in both modes.
      body = buildRequest({ ...args, messages: textMessages(args.messages) });
    } catch (e) {
      return toFailure(e);
    }
    const job = { ctl: new AbortController(), why: null, text: '' };
    active.set(requestId, job);
    const started = now();
    let result;
    try {
      result = useAgent ? await runAgent(requestId, args, job) : await runSend(requestId, body, job);
      if (result && result.ok && agent && !useAgent) result.toolsOff = true;
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
    agent?.cancelApprovals(requestId);
    return { ok: true };
  }

  function approve(args) {
    if (!agent) return { ok: false, error: 'Няма активно одобрение.' };
    return agent.approve(args);
  }

  return { status, signIn, cancelSignIn, signOut, detach, models, send, cancel, approve, consent, setConsent };
}
