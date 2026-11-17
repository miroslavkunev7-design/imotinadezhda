// CRM session of the signed-in employee. Tokens live only in MAIN (memory + encrypted file);
// the renderer only ever sees AuthState. The password is used for one request and never stored or logged.
import { SITE, SB_URL, SB_KEY } from "./config.js";
import { HttpError } from "./http.js";

const STORE = "session";
const REFRESH_MARGIN_S = 300; // refresh about 5 minutes before the access token expires
const PHONE_LOGIN = /^p(\d{10,15})@tel\.imotinadezhda\.bg$/i; // synthetic e-mail of phone-only accounts

const MSG = {
  input: "Въведете телефон или имейл и парола.",
  credentials: "Грешен телефон/имейл или парола.",
  rate: "Твърде много опити. Опитайте след 15 минути.",
  network: "Няма връзка със сървъра.",
  timeout: "Сървърът не отговори навреме. Опитайте отново.",
  refused: "Сървърът отказа входа от тази програма (HTTP 403).",
  notStaff: "Този профил няма достъп до CRM.",
  profile: "Профилът не можа да се зареди. Опитайте отново.",
  expired: "Сесията е изтекла – влезте отново.",
  offline: "Сесията не можа да се поднови – няма връзка със сървъра.",
};

// Decode only (no signature check): the claims are used for scheduling and display, never for trust.
export function decodeJwt(token) {
  try {
    const part = String(token).split(".")[1];
    const claims = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return claims && typeof claims === "object" ? claims : null;
  } catch { return null; }
}

export function jwtExp(token) {
  const exp = Number((decodeJwt(token) || {}).exp);
  return Number.isFinite(exp) && exp > 0 ? exp : null;
}

// Local expiry time (epoch seconds) of a token that was just issued. The lifetime (exp - iat) is added
// to this PC's clock, so a wrong system clock cannot cause a refresh storm or a stale token.
function expiryOf(token, nowS, expiresIn) {
  const claims = decodeJwt(token) || {};
  const life = Number(claims.exp) - Number(claims.iat);
  if (Number.isFinite(life) && life > 0) return nowS + life;
  return jwtExp(token) || nowS + (Number(expiresIn) || 3600);
}

// "+359 •••••• 456": enough to recognise the number, not enough to copy it.
export function maskPhone(value) {
  let d = String(value || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (/^0[89]\d{8}$/.test(d)) d = "359" + d.slice(1);
  if (d.length < 7) return "";
  return "+" + d.slice(0, 3) + " " + "•".repeat(d.length - 6) + " " + d.slice(-3);
}

// Supabase user -> the profile shown in the UI. Phone-only accounts hide the synthetic e-mail.
export function mapUser(u) {
  const src = u || {};
  const meta = src.user_metadata || {};
  const email = String(src.email || "");
  const synthetic = PHONE_LOGIN.exec(email);
  return {
    id: String(src.id || ""),
    name: String(meta.full_name || meta.name || "").trim().slice(0, 120),
    email: synthetic ? "" : email,
    phoneMasked: maskPhone(synthetic ? synthetic[1] : src.phone || meta.phone),
  };
}

const serverText = (json) => (json && typeof json.error === "string" && json.error.trim() ? json.error.trim().slice(0, 300) : "");

export function createSession({ http, secureStore, log, onChange, now = Date.now }) {
  let sess = null;        // { access_token, refresh_token, exp, user }
  let remembered = false; // true when the session is saved encrypted on disk
  let gen = 0;            // bumped on every sign-in/sign-out so stale async results are dropped
  let refreshing = null;  // single-flight: Supabase refresh tokens rotate, a reused one revokes the session
  let timer = null;
  let refreshFailedAt = 0; // last non-terminal refresh failure (ms)

  const state = () => (sess ? { status: "signedIn", user: { ...sess.user }, remembered } : { status: "signedOut" });
  const authError = () => new HttpError("auth", MSG.expired, false);

  function emit() {
    try { if (onChange) onChange(state()); } catch (e) { if (log) log.warn("session.listener_failed", { message: e.message }); }
  }

  function persist() {
    remembered = false;
    try {
      if (secureStore && secureStore.available()) { secureStore.write(STORE, sess); remembered = true; }
    } catch (e) { if (log) log.error("session.persist_failed", { message: e.message }); }
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!sess || !sess.exp) return;
    // The floor keeps a short-lived token from turning the timer into a tight loop.
    const ms = Math.max(30000, (sess.exp - REFRESH_MARGIN_S) * 1000 - now());
    timer = setTimeout(() => { refresh().catch(() => {}); }, Math.min(ms, 2 ** 31 - 1));
    if (timer.unref) timer.unref();
  }

  function clear(reason) {
    if (!sess) return;
    gen++;
    sess = null;
    remembered = false;
    clearTimeout(timer);
    timer = null;
    try { if (secureStore) secureStore.remove(STORE); } catch { /* ignore */ }
    if (log) log.info("session.cleared", { reason });
    emit();
  }

  async function doRefresh() {
    const g = gen;
    let res;
    try {
      res = await http.request({
        url: SB_URL + "/auth/v1/token?grant_type=refresh_token", method: "POST",
        headers: { apikey: SB_KEY }, json: { refresh_token: sess.refresh_token }, timeoutMs: 15000,
      });
    } catch (e) {
      if (log) log.warn("session.refresh_failed", { code: e.code });
      if (g === gen) refreshFailedAt = now();
      return { ok: false, terminal: false };
    }
    if (g !== gen) return { ok: false, terminal: false }; // signed out or signed in again meanwhile
    const j = res.json;
    if (res.ok && j && typeof j.access_token === "string" && typeof j.refresh_token === "string") {
      // Both tokens are replaced together.
      sess = {
        ...sess, access_token: j.access_token, refresh_token: j.refresh_token,
        exp: expiryOf(j.access_token, Math.floor(now() / 1000), j.expires_in),
      };
      persist();
      schedule();
      if (log) log.info("session.refreshed", { exp: sess.exp });
      return { ok: true };
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      clear("refresh_rejected"); // the refresh token is gone or revoked: back to the login screen
      return { ok: false, terminal: true };
    }
    if (log) log.warn("session.refresh_failed", { status: res.status });
    refreshFailedAt = now();
    return { ok: false, terminal: false };
  }

  function refresh() {
    if (!sess) return Promise.resolve({ ok: false, terminal: true });
    if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null; });
    return refreshing;
  }

  const secondsLeft = () => (sess && sess.exp ? sess.exp - now() / 1000 : Infinity);

  // A usable access token, refreshed first when it is about to expire.
  async function validToken() {
    if (!sess) throw authError();
    if (secondsLeft() > REFRESH_MARGIN_S) return sess.access_token;
    // A refresh has just failed (offline, 5xx): do not make every call wait for another attempt.
    if (secondsLeft() > 5 && now() - refreshFailedAt < 30000) return sess.access_token;
    const r = await refresh();
    if (!sess || r.terminal) throw authError();
    if (r.ok || secondsLeft() > 5) return sess.access_token; // refresh failed but the token still works for now
    throw new HttpError("network", MSG.offline, false);
  }

  async function getAccessToken() {
    try { return await validToken(); } catch { return null; }
  }

  // Request with Bearer. On 401: refresh once and retry the same request once - safe because the
  // server checks auth before it executes anything. No other automatic retry exists.
  async function authed(opts) {
    const token = await validToken();
    const send = (t) => http.request({ ...opts, headers: { ...(opts.headers || {}), Authorization: "Bearer " + t } });
    const first = await send(token);
    if (first.status !== 401) return first;
    if (!sess) throw authError();
    if (sess.access_token === token) { // otherwise another call has already rotated the tokens
      const r = await refresh();
      if (!sess || r.terminal) throw authError();
      if (!r.ok) throw new HttpError("network", MSG.offline, false);
    }
    const second = await send(sess.access_token);
    if (second.status === 401) clear("unauthorized_after_refresh");
    return second;
  }

  // Best effort: revokes this device's refresh token (scope=local keeps the website session alive).
  async function revoke(accessToken) {
    try {
      await http.request({
        url: SB_URL + "/auth/v1/logout?scope=local", method: "POST",
        headers: { apikey: SB_KEY, Authorization: "Bearer " + accessToken }, timeoutMs: 8000, as: "text",
      });
    } catch (e) { if (log) log.warn("session.revoke_failed", { code: e.code }); }
  }

  const fail = (code, error, status) => ({ ok: false, error, code, ...(status ? { status } : {}) });

  async function login(args) {
    const identifier = args && typeof args.identifier === "string" ? args.identifier.trim() : "";
    const password = args && typeof args.password === "string" ? args.password : "";
    if (!identifier || identifier.length > 254 || !password || password.length > 1024) return fail("invalid", MSG.input);

    let res;
    try {
      res = await http.request({
        url: SITE + "/api/register", method: "POST",
        json: { action: "auth-login", identifier, password }, timeoutMs: 20000,
      });
    } catch (e) {
      return e.code === "timeout" ? fail("timeout", MSG.timeout) : fail("network", MSG.network);
    }
    const j = res.json || {};
    if (res.status === 401) return fail("credentials", serverText(j) || MSG.credentials, 401);
    if (res.status === 429) return fail("rate", serverText(j) || MSG.rate, 429);
    if (res.status === 403) return fail("http", MSG.refused, 403);
    if (!res.ok || typeof j.access_token !== "string" || typeof j.refresh_token !== "string") {
      return fail("http", serverText(j) || `Входът временно не е достъпен (HTTP ${res.status}).`, res.status);
    }

    // Staff gate: only CRM employees may use the app.
    const bearer = { apikey: SB_KEY, Authorization: "Bearer " + j.access_token };
    let staff;
    try {
      staff = await http.request({ url: SB_URL + "/rest/v1/rpc/nd_is_staff", method: "POST", headers: bearer, json: {}, timeoutMs: 15000 });
    } catch (e) {
      await revoke(j.access_token);
      return e.code === "timeout" ? fail("timeout", MSG.timeout) : fail("network", MSG.network);
    }
    if (!staff.ok || staff.json !== true) {
      await revoke(j.access_token);
      return staff.ok ? fail("not_staff", MSG.notStaff)
        : fail("http", `Проверката на достъпа до CRM не успя (HTTP ${staff.status}). Опитайте отново.`, staff.status);
    }

    // Profile; the token's own claims are the fallback when the profile request fails.
    let profile = null;
    try {
      const u = await http.request({ url: SB_URL + "/auth/v1/user", headers: bearer, timeoutMs: 15000 });
      if (u.ok && u.json && u.json.id) profile = u.json;
    } catch { /* fallback below */ }
    const claims = decodeJwt(j.access_token) || {};
    const user = mapUser(profile || { id: claims.sub, email: claims.email, phone: claims.phone, user_metadata: claims.user_metadata });
    if (!user.id) {
      await revoke(j.access_token);
      return fail("http", MSG.profile);
    }

    gen++;
    sess = {
      access_token: j.access_token, refresh_token: j.refresh_token,
      exp: expiryOf(j.access_token, Math.floor(now() / 1000)), user,
    };
    persist();
    schedule();
    if (log) log.info("session.signed_in", { remembered });
    emit();
    return { ok: true, user: { ...user } };
  }

  async function logout() {
    const token = sess && sess.access_token;
    clear("logout"); // local wipe first: the login screen appears even when offline
    if (token) await revoke(token);
    return { ok: true };
  }

  // Loads the saved session. Never blocks on the network: an expired token is refreshed in the background.
  function init() {
    let saved = null;
    try { saved = secureStore ? secureStore.read(STORE) : null; } catch { saved = null; }
    if (saved && typeof saved.access_token === "string" && typeof saved.refresh_token === "string" && saved.user && saved.user.id) {
      const u = saved.user;
      sess = {
        access_token: saved.access_token, refresh_token: saved.refresh_token,
        exp: Number(saved.exp) || jwtExp(saved.access_token) || 0,
        user: { id: String(u.id), name: String(u.name || ""), email: String(u.email || ""), phoneMasked: String(u.phoneMasked || "") },
      };
      remembered = true;
      schedule();
    }
    return state();
  }

  return { init, state, login, logout, getAccessToken, authed };
}
