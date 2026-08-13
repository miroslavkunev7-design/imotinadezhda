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
      proxy: {
        "/__l5e": {
          target: "https://imotinadezhda.lovable.app",
          changeOrigin: true,
          secure: true,
        },
        "/media": {
          target: "https://imotinadezhda.lovable.app",
          changeOrigin: true,
          secure: true,
          rewrite: (p: string) => p.replace(/^\/media/, "/__l5e"),
        },
      },
    },
  },
});
