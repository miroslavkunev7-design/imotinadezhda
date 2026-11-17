// The application window: hardened webPreferences, Windows caption buttons drawn over the app's own title bar,
// remembered size/position and the compact (phone layout) mode. 0.1.6: the „Балонче“ window (createBubbleWindow) and
// the floating state of the main window (electron/bubble.js), whose bounds are never remembered as the normal ones.
export const TITLE = "Тед – Имоти Надежда";
export const DEFAULT_SIZE = { width: 1366, height: 860 };
export const COMPACT_SIZE = { width: 420, height: 860 };
export const MIN_SIZE = { width: 360, height: 560 };
const OVERLAY = { color: "#22030b", symbolColor: "#f3cf86", height: 36 };

const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));

// Saved bounds are used only when they are sane and still visible on a connected display.
export function usableBounds(b, displays) {
  if (!b || ![b.x, b.y, b.width, b.height].every(Number.isFinite)) return null;
  if (b.width < MIN_SIZE.width || b.height < MIN_SIZE.height) return null;
  const visible = (displays || []).some((d) => {
    const a = d.workArea;
    const w = Math.min(b.x + b.width, a.x + a.width) - Math.max(b.x, a.x);
    const h = Math.min(b.y + b.height, a.y + a.height) - Math.max(b.y, a.y);
    return w >= 120 && h >= 80;
  });
  return visible ? { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) } : null;
}

export function webPreferences({ preload, packaged }) {
  return {
    preload,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    webviewTag: false,
    navigateOnDragDrop: false,
    spellcheck: false,
    devTools: !packaged,
  };
}

// state: {get(), set(patch)} holding {bounds, maximized, compact}.
export function createMainWindow({ BrowserWindow, screen, Menu, state, preload, url, packaged, log }) {
  const saved = state.get();
  let normal = usableBounds(saved.bounds, screen.getAllDisplays()); // bounds of the full-size layout
  let maximized = !!saved.maximized;
  let compact = !!saved.compact;
  let floating = false; // 0.1.6: hidden behind the bubble or shown as the mini chat (electron/bubble.js)

  const start = normal
    ? (compact ? { x: normal.x, y: normal.y, ...COMPACT_SIZE } : normal)
    : (compact ? COMPACT_SIZE : DEFAULT_SIZE);
  const win = new BrowserWindow({
    ...start,
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    show: false,
    title: TITLE,
    backgroundColor: OVERLAY.color,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    titleBarOverlay: OVERLAY,
    webPreferences: webPreferences({ preload, packaged }),
  });
  if (!normal) normal = compact ? null : win.getBounds();

  function save() {
    if (win.isDestroyed()) return;
    if (!compact && !floating && !win.isMinimized() && !win.isFullScreen()) {
      normal = win.getNormalBounds();
      maximized = win.isMaximized();
    }
    try { state.set({ bounds: normal || undefined, maximized, compact }); } catch (e) { if (log) log.warn("window.state_not_saved", { message: e.message }); }
  }

  let saveTimer = null;
  const saveSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 600);
  };
  win.on("resize", saveSoon);
  win.on("move", saveSoon);
  win.on("close", () => {
    clearTimeout(saveTimer);
    save();
  });

  // Resizes to the phone layout (about 420x860) and back to the remembered full-size bounds.
  function setCompact(on) {
    const want = !!on;
    if (want === compact || win.isDestroyed()) return { ok: true };
    // The mini chat has its own size; the compact switch applies again in the normal window.
    if (floating) return { ok: false, error: "В балончето размерът се връща с „Нормален прозорец“." };
    if (want) {
      if (win.isFullScreen()) win.setFullScreen(false);
      normal = win.getNormalBounds();
      maximized = win.isMaximized();
      if (maximized) win.unmaximize();
      const now = win.getBounds();
      const area = screen.getDisplayMatching(now).workArea;
      const height = Math.min(COMPACT_SIZE.height, area.height);
      compact = true;
      win.setBounds({
        x: clamp(now.x, area.x, area.x + area.width - COMPACT_SIZE.width),
        y: clamp(now.y, area.y, area.y + area.height - height),
        width: COMPACT_SIZE.width,
        height,
      });
    } else {
      compact = false;
      if (normal) win.setBounds(normal); else win.setSize(DEFAULT_SIZE.width, DEFAULT_SIZE.height);
      if (maximized) win.maximize();
    }
    save();
    return { ok: true };
  }

  let revealed = false;
  const reveal = () => {
    if (revealed || win.isDestroyed()) return;
    revealed = true;
    if (maximized && !compact) win.maximize();
    win.show();
  };
  win.once("ready-to-show", reveal);
  // Safety net: never leave the app running without a visible window.
  const revealTimer = setTimeout(reveal, 5000);
  if (revealTimer.unref) revealTimer.unref();

  // With no application menu, offer the basic edit actions on right click.
  win.webContents.on("context-menu", (_event, p) => {
    const flags = p.editFlags || {};
    const items = p.isEditable
      ? [
        { role: "cut", label: "Изрежи", enabled: !!flags.canCut },
        { role: "copy", label: "Копирай", enabled: !!flags.canCopy },
        { role: "paste", label: "Постави", enabled: !!flags.canPaste },
        { type: "separator" },
        { role: "selectAll", label: "Избери всичко" },
      ]
      : (p.selectionText || "").trim() ? [{ role: "copy", label: "Копирай" }] : [];
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });

  win.webContents.on("did-fail-load", (_event, code, description, _failedUrl, isMainFrame) => {
    if (isMainFrame && log) log.error("window.load_failed", { errorCode: code, description });
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    if (log) log.error("window.renderer_gone", { reason: details && details.reason });
  });

  win.loadURL(url).catch((e) => { if (log) log.error("window.load_failed", { message: e.message }); });

  // While floating, the remembered state stays the one from before (bounds, maximised): a quit from the bubble or
  // the mini chat starts the next run in the normal window exactly as it was.
  function setFloating(on) {
    const want = !!on;
    if (want && !floating) { clearTimeout(saveTimer); save(); } // the state of the normal window as it is right now
    floating = want;
    if (!floating) save();
  }

  return { win, setCompact, isCompact: () => compact, setFloating, isFloating: () => floating };
}

export const BUBBLE_TITLE = "Тед – балонче";

// The bubble (0.1.6): a small frameless, transparent, round, always-on-top window without a taskbar button, with the
// same hardened webPreferences as the main window and its own preload (preload-bubble.cjs: only the bubble's moves
// and clicks – no CRM, ChatGPT or network function). Shown with showInactive(): it never takes the focus by itself.
// Returns {win, ready}; ready resolves when the page can be shown.
export function createBubbleWindow({ BrowserWindow, preload, url, packaged, log, platform, size = 64 }) {
  const win = new BrowserWindow({
    width: size, height: size, show: false, frame: false, transparent: true, backgroundColor: "#00000000", hasShadow: false,
    resizable: false, minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, alwaysOnTop: true,
    focusable: true, thickFrame: false, roundedCorners: false, autoHideMenuBar: true, title: BUBBLE_TITLE,
    // Windows: a tool window – no taskbar button and no Alt+Tab entry.
    ...(platform === "win32" ? { type: "toolbar" } : {}),
    webPreferences: webPreferences({ preload, packaged }),
  });
  win.setAlwaysOnTop(true, "floating");
  const ready = new Promise((resolve) => {
    win.once("ready-to-show", () => resolve(true));
    win.webContents.on("did-fail-load", (_event, code, description, _failedUrl, isMainFrame) => {
      if (!isMainFrame) return;
      if (log) log.error("bubble.load_failed", { errorCode: code, description });
      resolve(false);
    });
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    if (log) log.error("bubble.renderer_gone", { reason: details && details.reason });
    if (!win.isDestroyed()) win.destroy(); // electron/bubble.js brings the normal window back
  });
  win.loadURL(url).catch((e) => { if (log) log.error("bubble.load_failed", { message: e.message }); });
  return { win, ready };
}
