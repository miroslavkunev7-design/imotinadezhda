const { app, BrowserWindow, BrowserView, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const SITE_ORIGIN = process.env.CMS_SITE_ORIGIN || "https://imotinadezhda.bg";
const isDev = !app.isPackaged;
let mainWindow = null;
let previewView = null;
const PREVIEW_TOP = 56;
const SIDEBAR = 300;

function previewBounds() {
  if (!mainWindow) return { x: SIDEBAR, y: PREVIEW_TOP, width: 800, height: 400 };
  const [w, h] = mainWindow.getContentSize();
  const previewH = Math.max(220, Math.floor((h - PREVIEW_TOP) * 0.48));
  return { x: SIDEBAR, y: PREVIEW_TOP, width: Math.max(320, w - SIDEBAR), height: previewH };
}

function buildApplyScript(components, highlightKey) {
  const json = JSON.stringify({ components: components || [], highlightKey: highlightKey || null });
  return `(() => {
    const payload = ${json};
    if (!window.__imotiCmsApply) {
      window.__imotiCmsApply = function(list, highlightKey) {
        var STYLE_ID = "imoti-cms-live-style";
        var style = document.getElementById(STYLE_ID);
        if (!style) {
          style = document.createElement("style");
          style.id = STYLE_ID;
          document.documentElement.appendChild(style);
        }
        var rules = [];
        (list || []).forEach(function(c) {
          if (!c || !c.props) return;
          var p = c.props;
          if (c.type === "color" || (p.cssVar && p.value)) {
            try { document.documentElement.style.setProperty(p.cssVar || "--wine", String(p.value)); } catch (e) {}
          }
          if (p.selector && (c.type === "shape" || p.radius != null)) {
            rules.push(p.selector + "{border-radius:" + (p.radius || "16px") + " !important;}");
          }
          if (p.selector && c.type === "section_height" && p.height) {
            rules.push(p.selector + "{min-height:" + p.height + " !important;}");
          }
          if (p.selector && c.type === "size") {
            var bits = [];
            if (p.width) bits.push("width:" + p.width);
            if (p.height) bits.push("min-height:" + p.height);
            if (p.padding) bits.push("padding:" + p.padding);
            if (p.scale) bits.push("transform:scale(" + p.scale + ");transform-origin:top left");
            if (bits.length) rules.push(p.selector + "{" + bits.join(";") + " !important;}");
          }
          if (p.selector && (c.type === "image" || c.type === "melt") && p.url) {
            var els = document.querySelectorAll(p.selector);
            for (var i = 0; i < els.length; i++) {
              if (els[i].tagName === "IMG") els[i].src = p.url;
              else {
                els[i].style.backgroundImage = "url(" + JSON.stringify(p.url).slice(1, -1) + ")";
                els[i].style.backgroundSize = (p.fit || "cover");
              }
            }
          }
          if (p.selector && (c.type === "melt" || p.melt)) {
            var intensity = Number(p.intensity != null ? p.intensity : 0.65);
            var meltEls = document.querySelectorAll(p.selector);
            for (var j = 0; j < meltEls.length; j++) {
              meltEls[j].style.opacity = String(Math.max(0.15, Math.min(1, intensity)));
              if (p.mode === "vignette") meltEls[j].style.boxShadow = "inset 0 0 80px rgba(40,0,10," + intensity + ")";
              if (p.blend) meltEls[j].style.mixBlendMode = String(p.blend);
            }
          }
          if (p.selector && c.type === "graphics") {
            rules.push(p.selector + "{color:" + (p.color || "#c9922e") + ";width:" + (p.size || "44px") + ";height:" + (p.size || "44px") + ";}");
          }
        });
        var hl = highlightKey
          ? (list || []).find(function(x) { return x.component_key === highlightKey; })
          : null;
        var outline = "";
        if (hl && hl.props && hl.props.selector) {
          outline = String(hl.props.selector) + "{outline:3px solid #f0d4a0 !important;outline-offset:4px !important;box-shadow:0 0 0 4px rgba(201,146,46,.35)!important;}";
          try {
            var first = document.querySelector(String(hl.props.selector));
            if (first && first.scrollIntoView) first.scrollIntoView({ behavior: "smooth", block: "center" });
          } catch (e) {}
        }
        style.textContent = rules.join("\\n") + "\\n" + outline;
        try { window.dispatchEvent(new CustomEvent("cms-live-apply", { detail: { list: list, highlightKey: highlightKey } })); } catch (e) {}
        if (typeof window.__imotiCmsNativeApply === "function") {
          try { window.__imotiCmsNativeApply(list, highlightKey); } catch (e2) {}
        }
      };
    }
    window.__imotiCmsApply(payload.components, payload.highlightKey);
    return true;
  })()`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "Imoti Nadezhda Settings",
    backgroundColor: "#2a0a12",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  previewView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.setBrowserView(previewView);
  previewView.setBounds(previewBounds());
  previewView.setAutoResize({ width: true, height: false });
  previewView.webContents.loadURL(SITE_ORIGIN + "/?cms_preview=1&_=" + Date.now());

  mainWindow.on("resize", () => {
    if (previewView) previewView.setBounds(previewBounds());
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER || "http://127.0.0.1:5179");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

ipcMain.handle("preview:navigate", async (_e, target) => {
  if (!previewView) return { ok: false };
  let url = target;
  if (target.startsWith("#")) url = SITE_ORIGIN + "/" + target;
  else if (target.startsWith("/")) url = SITE_ORIGIN + target;
  else if (!/^https?:/i.test(target)) url = SITE_ORIGIN + "/" + target;
  const bust = (url.includes("?") ? "&" : "?") + "_=" + Date.now();
  await previewView.webContents.loadURL(url + bust);
  return { ok: true, url: url + bust };
});

ipcMain.handle("preview:reload", async () => {
  if (!previewView) return { ok: false };
  const current = previewView.webContents.getURL();
  const base = current.split("?")[0].split("#")[0];
  const hash = current.includes("#") ? "#" + current.split("#")[1].split("?")[0] : "";
  await previewView.webContents.loadURL(base + "?cms_preview=1&_=" + Date.now() + hash);
  try {
    await previewView.webContents.executeJavaScript(
      "try{sessionStorage.setItem('cms-bust',String(Date.now()))}catch(e){};location.reload()"
    );
  } catch (e) { /* ignore */ }
  return { ok: true };
});

ipcMain.handle("preview:apply", async (_e, components, highlightKey) => {
  if (!previewView) return { ok: false };
  try {
    await previewView.webContents.executeJavaScript(buildApplyScript(components, highlightKey));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

ipcMain.handle("preview:bounds", async (_e, ratio) => {
  if (!mainWindow || !previewView) return;
  const [w, h] = mainWindow.getContentSize();
  const previewH = Math.max(180, Math.floor((h - PREVIEW_TOP) * (ratio || 0.48)));
  previewView.setBounds({ x: SIDEBAR, y: PREVIEW_TOP, width: Math.max(320, w - SIDEBAR), height: previewH });
});

ipcMain.handle("dialog:openImage", async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: "Choose image",
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }]
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const filePath = r.filePaths[0];
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase().replace(".", "") || "png";
  const mime = ext === "jpg" ? "image/jpeg" : "image/" + (ext === "jpeg" ? "jpeg" : ext);
  return {
    name: path.basename(filePath),
    path: filePath,
    mime,
    dataUrl: "data:" + mime + ";base64," + buf.toString("base64"),
    bytes: buf.length
  };
});

ipcMain.handle("app:info", async () => ({
  siteOrigin: SITE_ORIGIN,
  version: app.getVersion(),
  installHint: "D:\\\\ImotiNadezhda-Settings"
}));

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
