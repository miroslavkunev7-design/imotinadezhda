// The renderer reaches the outside world only through this object (docs/CONTRACT.md §2).
// Production: window.ted from the sandboxed preload. Mock mode (vite --mode mock, browser only):
// a fixture bridge that is imported dynamically, so `vite build` never bundles it.
export let ted = typeof window !== "undefined" ? window.ted : undefined;

export async function initBridge() {
  if (!ted && import.meta.env.MODE === "mock") {
    const mock = await import("./mock/bridge.mock.js");
    ted = mock.createMockBridge();
  }
  return ted || null;
}
