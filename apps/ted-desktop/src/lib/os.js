// 0.1.8: on a Mac the program has its own look – white with red elements (src/styles/mac.css, under html.os-mac) – and
// says "Mac"/"macOS" where Windows is named. navigator.platform is read synchronously, so the right colours are there
// from the first frame; Windows and the tests (Linux) are unchanged.
const plat = typeof navigator !== "undefined" ? String(navigator.platform || navigator.userAgent || "") : "";
export const IS_MAC = /Mac/i.test(plat);
export const OS = IS_MAC ? "macOS" : "Windows";          // „известие на Windows“ / „известие на macOS“
export const PRODUCT = IS_MAC ? "Тед за Mac" : "Тед за Windows";
if (IS_MAC && typeof document !== "undefined") document.documentElement.classList.add("os-mac");
// Shortcut labels: the program accepts both Ctrl and ⌘ (App.jsx: e.ctrlKey || e.metaKey); a Mac shows ⌘.
export const kb = (s) => (IS_MAC ? String(s).replace(/\bCtrl\b/g, "⌘") : String(s));
