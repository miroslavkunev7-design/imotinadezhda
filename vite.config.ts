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
    plugins: [
      {
        name: "crm-pretty-urls",
        configureServer(server) {
          const pages: Record<string, string> = {
            "/crm": "/crm/index.html",
            "/crm/": "/crm/index.html",
            "/crm/klienti": "/crm/klienti.html",
            "/crm/klienti/": "/crm/klienti.html",
            "/crm/imoti": "/crm/imoti.html",
            "/crm/imoti/": "/crm/imoti.html",
            "/crm/brokeri": "/crm/brokeri.html",
            "/crm/brokeri/": "/crm/brokeri.html",
            "/crm/kalendar": "/crm/kalendar.html",
            "/crm/kalendar/": "/crm/kalendar.html",
            "/crm/kompanii": "/crm/kompanii.html",
            "/crm/kompanii/": "/crm/kompanii.html",
          };
          const redirects: Record<string, string> = {
            "/mobile/crm": "/crm",
            "/mobile/crm/": "/crm",
            "/mobile/crm/index.html": "/crm",
            "/mobile/crm/crm-nachalo.html": "/crm",
            "/mobile/crm/crm-klienti.html": "/crm/klienti",
            "/mobile/crm/crm-imoti.html": "/crm/imoti",
            "/mobile/crm/crm-brokeri.html": "/crm/brokeri",
            "/mobile/crm/crm-kalendar.html": "/crm/kalendar",
            "/mobile/crm/crm-kompanii.html": "/crm/kompanii",
          };
          server.middlewares.use((req, res, next) => {
            const raw = req.url ?? "/";
            const q = raw.indexOf("?");
            const pathname = q === -1 ? raw : raw.slice(0, q);
            const search = q === -1 ? "" : raw.slice(q);
            if (pathname.startsWith("/mobile/crm/assets/")) {
              res.statusCode = 308;
              res.setHeader("Location", `/crm/assets/${pathname.slice("/mobile/crm/assets/".length)}${search}`);
              res.end();
              return;
            }
            const redirectTo = redirects[pathname];
            if (redirectTo) {
              res.statusCode = 308;
              res.setHeader("Location", `${redirectTo}${search}`);
              res.end();
              return;
            }
            const mapped = pages[pathname];
            if (mapped) {
              req.url = `${mapped}${search}`;
            }
            next();
          });
        },
      },
    ],
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
