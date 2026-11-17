// The renderer reaches the outside world only through this object (docs/CONTRACT.md §2).
// Production: window.ted from the sandboxed preload. Mock mode (vite --mode mock, browser only):
// a fixture bridge loaded by a dynamic import. import.meta.env.MODE is replaced at build time, so
// in `vite build` the whole branch is dead code and the mock is never bundled (scripts/check-bundle.mjs).
export let ted = typeof window !== "undefined" ? window.ted : undefined;

export async function initBridge() {
  if (import.meta.env.MODE === "mock") {
    if (!ted) {
      const mock = await import("./mock/bridge.mock.js");
      ted = mock.createMockBridge();
    }
  }
  return ted || null;
}
