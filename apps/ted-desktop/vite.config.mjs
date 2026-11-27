import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { META_CSP } from "./electron/protocol.js";

// index.html (and bubble.html, 0.1.6 „Балонче“) carries the production policy verbatim (META_CSP: the app:// response header policy
// without frame-ancestors, which a <meta> cannot carry). The production and mock builds keep it
// unchanged, so the Playwright tests catch every violation the program would hit. Relaxed only for
// the dev server (vite / vite --mode mock): inline React Refresh preamble and the HMR websocket.
const META = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/;
const DEV_CSP = META_CSP.split("; ").map((d) => {
  if (d === "script-src 'self'") return "script-src 'self' 'unsafe-inline'";
  if (d === "style-src 'self'") return "style-src 'self' 'unsafe-inline'";
  if (d === "connect-src 'none'") return "connect-src 'self' ws: wss:";
  return d;
}).join("; ");

// Уеб версията (vite build --mode web → /mobile/ted/ на сайта): връзка към сайта и Supabase, работник (service worker) и манифест,
// за да може Google Chrome да я инсталира като програма (Mac и Windows).
const WEB_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https:; font-src 'self'; media-src 'self' data: blob:; connect-src 'self' https://hyvwfsmjbaynozceookv.supabase.co https:; frame-src 'none'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
const WEB_HEAD = '<link rel="manifest" href="manifest.webmanifest" />\n    <meta name="theme-color" content="#7a1226" />\n    <link rel="icon" href="icons/ted-192.png" />\n    <link rel="apple-touch-icon" href="icons/ted-192.png" />\n    <script src="register-sw.js" defer></script>';

function csp(mode) {
  return {
    name: "ted-csp",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const m = html.match(META);
        const page = String((ctx && ctx.filename) || "index.html").split(/[\\/]/).pop();
        if (!m) throw new Error(page + ": Content-Security-Policy meta is missing");
        if (m[2] !== META_CSP) throw new Error(page + ": CSP meta differs from electron/protocol.js META_CSP");
        if (mode === "web") return html.replace(META, `$1${WEB_CSP}$3`).replace("</title>", "</title>\n    " + WEB_HEAD);
        return ctx.server ? html.replace(META, `$1${DEV_CSP}$3`) : html;
      },
    },
  };
}

const PKG = JSON.parse(readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8"));

export default defineConfig(({ mode }) => mode === "web" ? {
  // уеб версията: само главната страница, изходът е в dist-web/ и се копира в mobile/ted/ на сайта
  base: "./",
  plugins: [react(), csp(mode)],
  publicDir: "web-public",
  define: { __TED_VERSION__: JSON.stringify(PKG.version + "-web") },
  build: {
    outDir: "dist-web", emptyOutDir: true, sourcemap: false, assetsInlineLimit: 0, modulePreload: { polyfill: false },
    rollupOptions: { input: { index: fileURLToPath(new URL("./index.html", import.meta.url)) } },
  },
} : ({
  base: "./",
  plugins: [react(), csp(mode)],
  server: { port: 5179, strictPort: true },
  preview: { host: "127.0.0.1", port: 4179, strictPort: true },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 0,                 // fonts and images stay emitted files (font-src 'self', no data:)
    modulePreload: { polyfill: false },   // the polyfill would use fetch(), which connect-src 'none' blocks
    // Two pages: the program and the „Балонче“ window (0.1.6) – app://ted/index.html and app://ted/bubble.html.
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        bubble: fileURLToPath(new URL("./bubble.html", import.meta.url)),
      },
    },
  },
}));
