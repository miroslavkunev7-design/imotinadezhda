const { app, BrowserWindow, BrowserView, ipcMain, session, dialog } = require("electron");
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
