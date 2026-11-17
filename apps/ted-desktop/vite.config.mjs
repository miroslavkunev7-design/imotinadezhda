import { fileURLToPath } from "node:url";
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

function csp() {
  return {
    name: "ted-csp",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const m = html.match(META);
        const page = String((ctx && ctx.filename) || "index.html").split(/[\\/]/).pop();
        if (!m) throw new Error(page + ": Content-Security-Policy meta is missing");
        if (m[2] !== META_CSP) throw new Error(page + ": CSP meta differs from electron/protocol.js META_CSP");
        return ctx.server ? html.replace(META, `$1${DEV_CSP}$3`) : html;
      },
    },
  };
}

export default defineConfig(() => ({
  base: "./",
  plugins: [react(), csp()],
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
