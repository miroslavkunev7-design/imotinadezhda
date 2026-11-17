import { defineConfig } from "@playwright/test";

// Renderer tests against the MOCK build (src/mock/bridge.mock.js) in plain Chromium.
// No test touches imotinadezhda.bg, Supabase or OpenAI: the page has connect-src 'none' and
// talks only to the mock window.ted. In this container: PW_CHROMIUM=/opt/pw-browsers/chromium.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]], // CI uploads playwright-report/ on failure
  outputDir: "test-results",
  use: {
    baseURL: "http://127.0.0.1:4179",
    viewport: { width: 1366, height: 860 },
    locale: "bg-BG",
    timezoneId: "Europe/Sofia",
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions: { executablePath: process.env.PW_CHROMIUM || undefined },
  },
  webServer: {
    command: "npm run build:mock && npx vite preview --outDir dist-mock --port 4179 --strictPort",
    url: "http://127.0.0.1:4179",
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
