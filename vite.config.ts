// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// On Vercel, force-enable Nitro with the `vercel` preset so the deploy plugin
// activates. On Lovable / Cloudflare, leave nitro on its auto default.
const isVercel = process.env.VERCEL === "1" || process.env.DEPLOY_TARGET === "vercel";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  nitro: isVercel ? { preset: "vercel" } : undefined,
  // On Vercel, lightningcss tries to resolve Tailwind v4's `@import "tailwindcss"`
  // before the Tailwind plugin can intercept it, causing ENOENT. Fall back to
  // the default PostCSS-based CSS pipeline there. CSS options must live under
  // `vite` — they are not a top-level option of the Lovable config wrapper.
  vite: isVercel ? { css: { transformer: "postcss" } } : undefined,
});
