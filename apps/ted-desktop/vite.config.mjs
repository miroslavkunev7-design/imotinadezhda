import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The built page keeps the strict CSP of index.html (same policy as the app:// response header).
// Only the Vite dev server needs inline scripts/styles and a websocket for HMR, so the policy is
// relaxed there and nowhere else (never in `vite build`, so never in the installed program).
const DEV_CSP = [
  "default-src 'none'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:", "font-src 'self' data:", "media-src 'self' blob:", "connect-src 'self' ws:",
  "frame-src 'none'", "worker-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'",
].join("; ");

function devCsp() {
  return {
    name: "ted-dev-csp",
    apply: "serve",
    transformIndexHtml(html) {
      return html.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]*(")/, `$1${DEV_CSP}$2`);
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), devCsp()],
  server: { port: 5179, strictPort: true },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 0,                 // no data: URIs for fonts/images (font-src 'self')
    modulePreload: { polyfill: false },   // the polyfill would use fetch(), which connect-src 'none' blocks
  },
});
