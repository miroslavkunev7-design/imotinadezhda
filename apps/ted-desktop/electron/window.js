// The single application window: hardened webPreferences, Windows caption buttons drawn over the
// app's own title bar, remembered size/position and the compact (phone layout) mode.
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
    if (!compact && !win.isMinimized() && !win.isFullScreen()) {
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

  win.once("ready-to-show", () => {
    if (maximized && !compact) win.maximize();
    win.show();
  });

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

  return { win, setCompact, isCompact: () => compact };
}
