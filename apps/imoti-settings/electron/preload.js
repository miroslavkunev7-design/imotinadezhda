const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("imotiSettings", {
  previewNavigate: (url) => ipcRenderer.invoke("preview:navigate", url),
  previewReload: () => ipcRenderer.invoke("preview:reload"),
  setPreviewRatio: (ratio) => ipcRenderer.invoke("preview:bounds", ratio),
  openImage: () => ipcRenderer.invoke("dialog:openImage"),
  appInfo: () => ipcRenderer.invoke("app:info")
});
