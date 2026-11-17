// Sandboxed preload: exposes the fixed window.ted API of docs/CONTRACT.md §2 and nothing else.
// There is no generic invoke and no generic tool call; every function is bound to one channel.
"use strict";
const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

// Push event -> subscription that returns unsubscribe().
function subscribe(channel, callback) {
  if (typeof callback !== "function") return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("ted", {
  app: {
    info: () => invoke("ted:app.info"),
    setCompact: (on) => invoke("ted:app.setCompact", !!on),
    getLaunchAtLogin: () => invoke("ted:app.getLaunchAtLogin"),
    setLaunchAtLogin: (on) => invoke("ted:app.setLaunchAtLogin", !!on),
    openLogs: () => invoke("ted:app.openLogs"),
    openExternal: (url) => invoke("ted:app.openExternal", url),
    copy: (text) => invoke("ted:app.copy", text),
    saveFile: (args) => invoke("ted:app.saveFile", args),
  },
  auth: {
    state: () => invoke("ted:auth.state"),
    login: (args) => invoke("ted:auth.login", args),
    logout: () => invoke("ted:auth.logout"),
    onChange: (callback) => subscribe("ted:auth.changed", callback),
  },
  api: {
    models: () => invoke("ted:api.models"),
    chat: (args) => invoke("ted:api.chat", args),
    cancel: (requestId) => invoke("ted:api.cancel", requestId),
  },
  crm: {
    read: (tool, input) => invoke("ted:crm.read", tool, input),
  },
  cases: {
    create: (args) => invoke("ted:cases.create", args),
  },
  memory: {
    remember: (args) => invoke("ted:memory.remember", args),
    forget: (args) => invoke("ted:memory.forget", args),
  },
  email: {
    confirmSend: (args) => invoke("ted:email.confirmSend", args),
  },
  voice: {
    tts: (args) => invoke("ted:voice.tts", args),
    transcribe: (args) => invoke("ted:voice.transcribe", args),
  },
  store: {
    getSettings: () => invoke("ted:store.getSettings"),
    setSettings: (patch) => invoke("ted:store.setSettings", patch),
    loadChats: () => invoke("ted:store.loadChats"),
    saveChats: (chats) => invoke("ted:store.saveChats", chats),
    clearLocal: () => invoke("ted:store.clearLocal"),
  },
  realgpt: {
    status: () => invoke("ted:realgpt.status"),
    // {newAccount:true} starts a fresh registration (another ChatGPT account or a deleted one).
    signIn: (opts) => invoke("ted:realgpt.signIn", { newAccount: !!(opts && opts.newAccount === true) }),
    cancelSignIn: () => invoke("ted:realgpt.cancelSignIn"),
    signOut: () => invoke("ted:realgpt.signOut"),
    models: () => invoke("ted:realgpt.models"),
    send: (args) => invoke("ted:realgpt.send", args),
    cancel: (requestId) => invoke("ted:realgpt.cancel", requestId),
    onDelta: (callback) => subscribe("ted:realgpt.delta", callback),
  },
});
