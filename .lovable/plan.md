# Plan: Role-based access tests for admin server functions

## Goal
Automated tests that prove only users with the `admin` role in `user_roles` can execute:
- `scanClientFromImage` (src/lib/crm-scan.functions.ts)
- `scrapeReference` (src/lib/page-builder/page-builder.functions.ts)
- `generateFromReference` (src/lib/page-builder/page-builder.functions.ts)

## Approach
The three handlers all gate via the same pattern: `requireSupabaseAuth` middleware → `assertAdmin(context.userId)` → external API call. The role check is what we need to lock down with tests. Strategy:

1. **Refactor `assertAdmin` into a shared, exported helper** at `src/lib/auth/assert-admin.ts` so both files import the same function and it can be unit-tested directly. Both current copies are replaced with imports — no behavior change.

2. **Add vitest** as a dev dependency and a minimal `vitest.config.ts` (jsdom not needed; node environment). Add `"test": "vitest run"` script.

3. **Unit tests for `assertAdmin`** (`src/lib/auth/assert-admin.test.ts`) — mock `@/integrations/supabase/client.server` so the chained `.from().select().eq().eq().maybeSingle()` returns either `{ data: { role: "admin" } }` or `{ data: null }`. Assert:
   - resolves for admin user
   - throws `"Forbidden — admin only"` for non-admin user

4. **Handler-level tests** (`src/lib/crm-scan.functions.test.ts`, `src/lib/page-builder/page-builder.functions.test.ts`) — since `createServerFn` chains aren't trivially callable in unit tests, we test the gating by invoking the inner handler logic through the exported `assertAdmin` plus a thin integration check: import the server fn modules and verify that calling them (with mocked `assertAdmin` throwing) propagates the Forbidden error and never reaches `fetch`. We mock `global.fetch` and the admin module; assert:
   - non-admin → throws Forbidden, `fetch` not called
   - admin → `fetch` is called (we stub a minimal successful response so the handler completes)

5. **Run `bunx vitest run`** to confirm green.

## Technical details

- `assertAdmin` signature stays `(userId: string) => Promise<void>`.
- Mocks use `vi.mock("@/integrations/supabase/client.server", ...)` returning a builder whose terminal `maybeSingle()` is configurable per test.
- For handler tests we call `await fn({ data: <valid input>, context: { userId: "u1" } } as any)` against the `.handler` callback — to enable this we'll expose the raw handler by extracting it into a named function (e.g. `scanClientFromImageHandler`) used by `createServerFn(...).handler(scanClientFromImageHandler)`. This keeps zero runtime change but makes the handler unit-testable without spinning up the TanStack RPC layer.
- `fetch` is stubbed with `vi.stubGlobal("fetch", vi.fn(...))`; `process.env.LOVABLE_API_KEY` and `FIRECRAWL_API_KEY` set in test setup.

## Files touched
- new: `src/lib/auth/assert-admin.ts`
- new: `src/lib/auth/assert-admin.test.ts`
- new: `src/lib/crm-scan.functions.test.ts`
- new: `src/lib/page-builder/page-builder.functions.test.ts`
- new: `vitest.config.ts`
- edited: `src/lib/crm-scan.functions.ts` (import shared `assertAdmin`, export handler fn)
- edited: `src/lib/page-builder/page-builder.functions.ts` (same)
- edited: `package.json` (add `vitest` devDep + `test` script)

## Out of scope
- End-to-end HTTP tests against the live server (would require dev server + real Supabase session).
- Tests for other admin-gated functions (saveDesign, publishDesign, deleteDesign) — can be added later using the same pattern if desired.
