# AGENTS.md

Guidance for cloud agents working in this repository.

## Product overview

**Imoti Nadezhda (ИЛДЖ.ИА)** — Bulgarian luxury real-estate site and admin CRM built with TanStack Start (React 19 + Vite 7), Tailwind CSS 4, and Supabase. Optional **cross-post worker** lives in `worker/` (Playwright; not required for main app dev).

## Cursor Cloud specific instructions

### Services

| Service | Required for local dev? | How to run |
|---------|-------------------------|------------|
| Web app (TanStack Start) | **Yes** | `npm run dev` (default port **5173**) |
| Supabase (remote) | **Yes** for real data | Configured via root `.env` (not local Docker) |
| Cross-post worker | No | `worker/` — separate Playwright process |
| Lovable AI / email / scraper | No | Only for AI chat, email queue, Firecrawl scraper |

### Dependency install

Use npm with legacy peer deps (matches `vercel.json`):

```bash
npm install --legacy-peer-deps
```

The repo also has `bun.lock` for CI visual tests; **npm is the primary package manager** for app development.

### Common commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Format | `npm run format` |
| Build (local) | `npm run build` |
| Build (Vercel preset) | `DEPLOY_TARGET=vercel npm run build` |
| Preview production build | `npm run preview` |

### Environment variables

Copy from `.env.example` if `.env` is missing. Minimum for public site + search:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (server-side)

Admin SSR, customer chat, and email routes additionally need `SUPABASE_SERVICE_ROLE_KEY` and `LOVABLE_API_KEY`.

### Gotchas

- **No unit/integration test suite** in-repo; verification is via lint, build, and manual/browser checks. Visual regression scripts live under `scripts/` and `tests/visual/`.
- **`npm run lint` reports many Prettier/style issues** (especially under `worker/`). This is pre-existing; do not treat lint clean as a gate unless you are fixing formatting.
- **Local `npm run build` may fail** without network access for Google Fonts (`src/styles.css` `@import url(...)`) when Vite uses the lightningcss transformer. Dev server (`npm run dev`) works. Vercel builds use `DEPLOY_TARGET=vercel` and the postcss CSS transformer via `vite.config.ts`.
- **`DEPLOY_TARGET=vercel npm run build`** can fail on missing `undici` resolution from `@mendable/firecrawl-js` during the Nitro bundling step — a known bundling edge case; production deploys on Vercel/Lovable may still succeed with their build environment.
- **Supabase is remote** (`supabase/config.toml` → project `zcrzxgzyptqibsajoece`). There is no `docker-compose` for a local stack.
- Property search is at `/search`; loader data comes from `searchProperties` in `src/lib/catalog.functions.ts`.
- Restart the dev server after dependency installs if HMR behaves oddly.

### Hello-world verification

1. Start dev server: `npm run dev`
2. Open `http://localhost:5173/` — Bulgarian homepage title "Недвижими имоти Надежда"
3. Visit `/search` — listings load from Supabase (e.g. property search results with prices/locations)
