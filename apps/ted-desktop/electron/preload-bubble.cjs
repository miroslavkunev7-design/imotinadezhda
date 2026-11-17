// Sandboxed preload of the „Балонче“ window (0.1.6, docs/CONTRACT.md §22). It exposes ONLY the bubble's own moves and
// clicks as window.tedBubble – no CRM, ChatGPT, file or network function, and no window.ted. Every function is bound
// to one fixed channel "ted-bubble:<fn>"; MAIN accepts them only from the bubble window (electron/bubble.js).
"use strict";
const { contextBridge, ipcRenderer } = require("electron");

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

contextBridge.exposeInMainWorld("tedBubble", {
  ready: () => ipcRenderer.invoke("ted-bubble:ready"),
  dragStart: () => ipcRenderer.invoke("ted-bubble:dragStart"),
  dragMove: (dx, dy) => ipcRenderer.invoke("ted-bubble:dragMove", num(dx), num(dy)),
  dragEnd: (dx, dy) => ipcRenderer.invoke("ted-bubble:dragEnd", num(dx), num(dy)),
  click: () => ipcRenderer.invoke("ted-bubble:click"),
  openNormal: () => ipcRenderer.invoke("ted-bubble:openNormal"),
  menu: () => ipcRenderer.invoke("ted-bubble:menu"),
  // {mode, unread, working, attention, side}; returns unsubscribe().
  onState: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("ted-bubble:state", listener);
    return () => ipcRenderer.removeListener("ted-bubble:state", listener);
  },
});
