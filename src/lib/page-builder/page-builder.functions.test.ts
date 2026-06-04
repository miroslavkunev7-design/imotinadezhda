import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let isAdmin = false;

vi.mock("@/lib/auth/assert-admin", () => ({
  assertAdmin: vi.fn(async (_userId: string) => {
    if (!isAdmin) throw new Error("Forbidden — admin only");
  }),
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: { _id: "stub" },
}));

// Stub Firecrawl so we never hit the network or require the real package.
const firecrawlScrape = vi.fn(async () => ({
  branding: { colors: { primary: "#000" } },
  screenshot: "data:image/png;base64,xx",
  markdown: "# hi",
  html: "<html></html>",
  metadata: { title: "ref" },
}));

vi.mock("@mendable/firecrawl-js", () => ({
  default: class {
    scrape = firecrawlScrape;
  },
}));

// Block registry import inside generateFromReferenceHandler.
vi.mock("./blocks", () => ({
  BLOCK_REGISTRY: [
    { type: "navbar.simple", label: "Navbar", category: "nav", defaults: { title: "" } },
    { type: "hero.basic", label: "Hero", category: "hero", defaults: { headline: "" } },
  ],
}));

import {
  scrapeReferenceHandler,
  generateFromReferenceHandler,
} from "./page-builder.functions";

beforeEach(() => {
  isAdmin = false;
  process.env.FIRECRAWL_API_KEY = "test-firecrawl";
  process.env.LOVABLE_API_KEY = "test-lovable";
  firecrawlScrape.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scrapeReference admin gate", () => {
  it("rejects non-admin users and never calls Firecrawl", async () => {
    await expect(
      scrapeReferenceHandler(
        { url: "https://example.com", mode: "similar" },
        { userId: "non-admin" },
      ),
    ).rejects.toThrow(/Forbidden/);
    expect(firecrawlScrape).not.toHaveBeenCalled();
  });

  it("allows admin users and calls Firecrawl", async () => {
    isAdmin = true;
    const out = await scrapeReferenceHandler(
      { url: "https://example.com", mode: "clone" },
      { userId: "admin-1" },
    );
    expect(firecrawlScrape).toHaveBeenCalledOnce();
    expect(out.url).toBe("https://example.com");
    expect(out.title).toBe("ref");
  });
});

describe("generateFromReference admin gate", () => {
  const baseInput = {
    mode: "similar" as const,
    page_slug: "home" as const,
    scraped: { url: "https://example.com", markdown: "# hi", title: "x", branding: {} },
  };

  it("rejects non-admin users and never calls the AI gateway", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateFromReferenceHandler(baseInput, { userId: "non-admin" }),
    ).rejects.toThrow(/Forbidden/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows admin users and calls the AI gateway", async () => {
    isAdmin = true;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                blocks: [{ type: "navbar.simple", props: {} }],
              }),
            },
          },
        ],
      }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock as any);

    const out = await generateFromReferenceHandler(baseInput, { userId: "admin-1" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(out.layout.blocks[0].type).toBe("navbar.simple");
  });
});
