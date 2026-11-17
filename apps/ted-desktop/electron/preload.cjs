// Sandboxed preload: exposes the fixed window.ted API of docs/CONTRACT.md §2 and §8 and nothing else.
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
    storage: () => invoke("ted:app.storage"),
    clearTemp: () => invoke("ted:app.clearTemp"),
    reportProblem: () => invoke("ted:app.reportProblem"),
  },
  auth: {
    state: () => invoke("ted:auth.state"),
    login: (args) => invoke("ted:auth.login", args),
    logout: () => invoke("ted:auth.logout"),
    onChange: (callback) => subscribe("ted:auth.changed", callback),
  },
  api: {
    // {fresh:true}: the connection check asks the server again instead of MAIN's short cache.
    models: (opts) => invoke("ted:api.models", opts && opts.fresh === true ? { fresh: true } : undefined),
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
    consent: () => invoke("ted:realgpt.consent"),
    setConsent: (choice) => invoke("ted:realgpt.setConsent", choice),
    approve: (args) => invoke("ted:realgpt.approve", args),
    onEvent: (callback) => subscribe("ted:realgpt.event", callback),
    openInChatGpt: (args) => invoke("ted:realgpt.openInChatGpt", args),
  },
  files: {
    add: (args) => invoke("ted:files.add", args),
    read: (args) => invoke("ted:files.read", args),
    extract: (args) => invoke("ted:files.extract", args),
    open: (id) => invoke("ted:files.open", id),
    save: (id) => invoke("ted:files.save", id),
    forget: (id) => invoke("ted:files.forget", id),
  },
  browse: {
    test: (args) => invoke("ted:browse.test", args),
    image: (args) => invoke("ted:browse.image", args),
  },
  video: {
    prepare: (args) => invoke("ted:video.prepare", args),
    start: (args) => invoke("ted:video.start", args),
    cancel: (args) => invoke("ted:video.cancel", args),
    finish: (args) => invoke("ted:video.finish", args),
    onEvent: (callback) => subscribe("ted:video.event", callback),
  },
  library: {
    list: (args) => invoke("ted:library.list", args),
    remove: (id) => invoke("ted:library.remove", id),
    clear: () => invoke("ted:library.clear"),
    onChange: (callback) => subscribe("ted:library.changed", callback),
  },
  projects: {
    assign: (args) => invoke("ted:projects.assign", args),
    saveAnswer: (args) => invoke("ted:projects.saveAnswer", args),
    exportZip: (args) => invoke("ted:projects.exportZip", args),
    saveToCrm: (args) => invoke("ted:projects.saveToCrm", args),
  },
  scheduled: {
    list: () => invoke("ted:scheduled.list"),
    save: (task) => invoke("ted:scheduled.save", task),
    remove: (id) => invoke("ted:scheduled.remove", id),
    onDue: (callback) => subscribe("ted:scheduled.due", callback),
  },
  updates: {
    state: () => invoke("ted:updates.state"),
    check: () => invoke("ted:updates.check"),
    setAuto: (on) => invoke("ted:updates.setAuto", !!on),
    download: () => invoke("ted:updates.download"),
    install: () => invoke("ted:updates.install"),
    onChange: (callback) => subscribe("ted:updates.changed", callback),
  },
  // 0.1.6 „Балонче“ (docs/CONTRACT.md §22): no arguments are passed on.
  window: {
    bubble: () => invoke("ted:window.bubble"),
    miniChat: () => invoke("ted:window.miniChat"),
    restore: () => invoke("ted:window.restore"),
    state: () => invoke("ted:window.state"),
    onMode: (callback) => subscribe("ted:window.mode", callback),
  },
});
