const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("imotiSettings", {
  previewNavigate: (url) => ipcRenderer.invoke("preview:navigate", url),
  previewReload: () => ipcRenderer.invoke("preview:reload"),
  previewApply: (components, highlightKey) => ipcRenderer.invoke("preview:apply", components, highlightKey),
  setPreviewRatio: (ratio) => ipcRenderer.invoke("preview:bounds", ratio),
  openImage: () => ipcRenderer.invoke("dialog:openImage"),
  appInfo: () => ipcRenderer.invoke("app:info")
});
