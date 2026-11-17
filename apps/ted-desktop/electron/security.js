// Electron hardening: the window can only show the app itself, cannot open windows, webviews or
// downloads, and may use nothing but the microphone. External links open in the system browser.
import { APP_ORIGIN } from "./protocol.js";

// True for app://ted and app://ted/... (and, in development only, the Vite dev server origin).
// Chromium reports origins with or without the trailing slash, so both forms are accepted.
export function createOriginCheck(devOrigin) {
  const origins = [APP_ORIGIN, ...(devOrigin ? [devOrigin] : [])];
  return (url) => typeof url === "string" && origins.some((o) => url === o || url.startsWith(o + "/"));
}

// Only https: and mailto: links may leave the app. Returns the normalised URL or null.
export function externalUrl(value) {
  if (typeof value !== "string" || !value || value.length > 8192) return null;
  let u;
  try { u = new URL(value); } catch { return null; }
  if (u.protocol === "mailto:") return u.href;
  if (u.protocol === "https:" && u.hostname && !u.username && !u.password) return u.href;
  return null;
}

export function installSecurity({ app, session, shell, log, devOrigin }) {
  const isApp = createOriginCheck(devOrigin);

  async function openExternal(value) {
    const url = externalUrl(value);
    if (!url) return { ok: false, error: "Този адрес не може да бъде отворен от програмата." };
    try {
      await shell.openExternal(url);
      return { ok: true };
    } catch {
      return { ok: false, error: "Адресът не можа да се отвори." };
    }
  }

  app.on("web-contents-created", (_event, contents) => {
    const guard = (event, url) => {
      const target = (event && event.url) || url;
      if (!isApp(target)) {
        event.preventDefault();
        if (log) log.warn("security.navigation_blocked", { scheme: String(target).split(":")[0].slice(0, 20) });
      }
    };
    contents.on("will-navigate", guard);
    contents.on("will-redirect", guard);
    contents.on("will-frame-navigate", guard);
    contents.on("will-attach-webview", (event) => event.preventDefault());
    contents.setWindowOpenHandler(({ url }) => {
      openExternal(url); // https:/mailto: go to the system browser; everything else is dropped
      return { action: "deny" };
    });
  });

  // Files are saved through the native "save as" dialog in MAIN, never by a renderer download.
  session.on("will-download", (event) => event.preventDefault());

  // Microphone only (dictation, voice mode), and only for the app's own pages.
  session.setPermissionRequestHandler((contents, permission, callback, details) => {
    const d = details || {};
    const from = d.requestingUrl || d.securityOrigin || (contents && contents.getURL && contents.getURL()) || "";
    const types = Array.isArray(d.mediaTypes) ? d.mediaTypes : [];
    callback(permission === "media" && types.length > 0 && types.every((t) => t === "audio") && isApp(from));
  });
  session.setPermissionCheckHandler((_contents, permission, requestingOrigin, details) => {
    const d = details || {};
    return permission === "media" && d.mediaType === "audio" && isApp(requestingOrigin || d.securityOrigin || "");
  });
  session.setDevicePermissionHandler(() => false);

  return { openExternal, isApp };
}
