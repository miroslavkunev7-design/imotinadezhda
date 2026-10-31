import path from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    importProtection: {
      behavior: "error",
      client: {
        files: ["**/server/**"],
        specifiers: ["server-only"],
      },
    },
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
    },
    server: {
      host: "::",
      port: 8080,
      // Allow Cloudflare quick tunnels / phone preview hosts.
      allowedHosts: true,
      // Quick tunnels break Vite HMR websockets on phones → client hydrate fails
      // into the root "Try again" error page. Keep SSR/dev modules, skip HMR.
      hmr: false,
    },
  },
});
