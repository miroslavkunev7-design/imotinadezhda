// Automatic updates (docs/CONTRACT.md §14) with electron-updater (MIT) and the generic provider of
// electron-builder.yml: https://github.com/miroslavkunev7-design/imotinadezhda/releases/latest/download
// (latest.yml + Ted-Setup-<version>-x64.exe). The installer is checked against the sha512 in latest.yml; the
// build is unsigned (no publisherName), so electron-updater skips the Authenticode check. Its network runs in
// the session "electron-updater", limited here to three GitHub hosts over HTTPS, without credentials. It never
// carries a CRM or OpenAI token. Off in development, on non-Windows systems and in --smoke-test.
export const FEED_URL = "https://github.com/miroslavkunev7-design/imotinadezhda/releases/latest/download";
export const UPDATE_HOSTS = ["github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"];
export const UPDATER_PARTITION = "electron-updater";
export const FIRST_CHECK_MS = 20_000;
export const INTERVAL_MS = 6 * 3600_000;

export function updateUrlAllowed(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" && !u.username && !u.password && (u.port === "" || u.port === "443") && UPDATE_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

// Installs the host filter (every request and redirect hop of the session, also those of Electron net) and,
// as defence in depth, header stripping on the updater's own session. The generic provider never sends an
// Authorization header or a cookie in the first place (no token is configured; the session keeps no cookies).
export function restrictUpdaterSession(ses, log) {
  ses.webRequest.onBeforeRequest((details, cb) => {
    if (updateUrlAllowed(details.url)) { cb({}); return; }
    if (log) log.warn("updater.blocked", { host: (() => { try { return new URL(details.url).hostname; } catch { return "?"; } })() });
    cb({ cancel: true });
  });
  ses.webRequest.onBeforeSendHeaders((details, cb) => {
    const headers = { ...(details.requestHeaders || {}) };
    for (const k of Object.keys(headers)) if (/^(authorization|cookie)$/i.test(k)) delete headers[k];
    cb({ requestHeaders: headers });
  });
}

function friendlyError(err) {
  const m = String((err && (err.message || err.code)) || err || "");
  if (/ERR_INTERNET_DISCONNECTED|ENOTFOUND|ERR_NAME_NOT_RESOLVED|ETIMEDOUT|ERR_CONNECTION/i.test(m)) return "Няма връзка с GitHub – проверката ще се повтори по-късно.";
  if (/\b404\b|Cannot find latest\.yml|Cannot find channel/i.test(m)) return "В последното издание няма файл за обновяване (latest.yml).";
  if (/sha512|checksum/i.test(m)) return "Изтегленият файл не съвпада с контролната сума – обновлението е отказано.";
  if (/ERR_BLOCKED_BY_CLIENT|cancel/i.test(m)) return "Адресът за обновяване е извън разрешените сайтове на GitHub.";
  return "Проверката за обновления не успя.";
}

// loadUpdater() -> the electron-updater autoUpdater (imported only when updates are supported).
export function createUpdater({
  loadUpdater, getSession, app, settings, log, smoke = false, platform = process.platform, packaged = false, emit = () => {},
  timers = { setTimeout, setInterval, clearTimeout, clearInterval }, now = () => new Date(),
}) {
  const supported = !!packaged && platform === "win32" && !smoke;
  const auto = () => { const u = (settings.get() || {}).updates; return !(u && u.auto === false); };
  let st = { status: supported ? "idle" : "disabled" };
  let updater = null;
  let first = null;
  let every = null;
  let checking = null;

  const state = () => ({ supported, version: app.getVersion(), auto: auto(), ...st });
  const set = (patch) => {
    st = { ...st, ...patch };
    for (const k of Object.keys(st)) if (st[k] === undefined) delete st[k];
    try { emit(state()); } catch { /* window gone */ }
  };

  async function ensure() {
    if (!supported) return null;
    if (updater) return updater;
    if (getSession) restrictUpdaterSession(getSession(UPDATER_PARTITION), log);
    const u = await loadUpdater();
    u.autoDownload = auto();
    u.autoInstallOnAppQuit = auto();
    u.allowPrerelease = false;
    u.allowDowngrade = false;
    u.disableDifferentialDownload = true; // differentialPackage:false – there is no .blockmap
    u.disableWebInstaller = true;
    u.logger = {
      info: (m) => log && log.info("updater", { message: String(m).slice(0, 300) }),
      warn: (m) => log && log.warn("updater", { message: String(m).slice(0, 300) }),
      error: (m) => log && log.error("updater", { message: String(m).slice(0, 300) }),
      debug: () => {},
    };
    u.on("checking-for-update", () => set({ status: "checking", error: undefined }));
    u.on("update-available", (info) => set({ status: u.autoDownload ? "downloading" : "available", available: { version: String(info && info.version), ...(info && info.releaseDate ? { releaseDate: String(info.releaseDate) } : {}) }, lastCheck: now().toISOString() }));
    u.on("update-not-available", () => set({ status: "none", available: undefined, progress: undefined, lastCheck: now().toISOString() }));
    u.on("download-progress", (p) => set({ status: "downloading", progress: { percent: Math.round(Number(p && p.percent) || 0), transferred: Number(p && p.transferred) || 0, total: Number(p && p.total) || 0 } }));
    u.on("update-downloaded", (info) => set({ status: "ready", progress: undefined, available: { version: String(info && info.version), ...(info && info.releaseDate ? { releaseDate: String(info.releaseDate) } : {}) } }));
    u.on("error", (e) => {
      if (log) log.warn("updater.error", { message: String((e && e.message) || e).slice(0, 200) });
      set({ status: "error", error: friendlyError(e), progress: undefined, lastCheck: now().toISOString() });
    });
    updater = u;
    return u;
  }

  async function check() {
    if (!supported) return state();
    if (st.status === "downloading" || st.status === "ready") return state();
    if (!checking) {
      checking = (async () => {
        try {
          const u = await ensure();
          await u.checkForUpdates();
        } catch (e) {
          set({ status: "error", error: friendlyError(e), lastCheck: now().toISOString() });
        } finally {
          checking = null;
        }
      })();
    }
    await checking;
    return state();
  }

  async function setAuto(on) {
    const value = !!on;
    const cur = settings.get() || {};
    settings.set({ updates: { ...(cur.updates && typeof cur.updates === "object" ? cur.updates : {}), auto: value } });
    if (updater) {
      updater.autoDownload = value;
      updater.autoInstallOnAppQuit = value;
      if (value && st.status === "available") {
        set({ status: "downloading" });
        updater.downloadUpdate().catch((e) => set({ status: "error", error: friendlyError(e) }));
      }
    }
    try { emit(state()); } catch { /* window gone */ }
    return state();
  }

  async function download() {
    if (!updater || st.status !== "available") return { ok: false, error: "Няма налично обновление за изтегляне." };
    set({ status: "downloading" });
    updater.downloadUpdate().catch((e) => set({ status: "error", error: friendlyError(e) }));
    return { ok: true };
  }

  function install() {
    if (!updater || st.status !== "ready") return { ok: false, error: "Обновлението още не е изтеглено." };
    // Silent install into the same per-user folder, then the program starts again.
    updater.quitAndInstall(true, true);
    return { ok: true };
  }

  function start() {
    if (!supported || first) return;
    first = timers.setTimeout(() => { check(); }, FIRST_CHECK_MS);
    every = timers.setInterval(() => { check(); }, INTERVAL_MS);
    if (first && first.unref) first.unref();
    if (every && every.unref) every.unref();
  }
  function stop() {
    if (first) timers.clearTimeout(first);
    if (every) timers.clearInterval(every);
    first = null;
    every = null;
  }

  return { state, check, setAuto, download, install, start, stop, supported };
}
