import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Toggle whether the mocked assertAdmin allows the call through.
let isAdmin = false;

vi.mock("@/lib/auth/assert-admin", () => ({
  assertAdmin: vi.fn(async (_userId: string) => {
    if (!isAdmin) throw new Error("Forbidden — admin only");
  }),
}));

// Avoid loading the real auth middleware (needs request context).
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: { _id: "stub" },
}));

import { scanClientFromImageHandler } from "./crm-scan.functions";

const validInput = {
  imageBase64: "a".repeat(120),
  mimeType: "image/png",
};

beforeEach(() => {
  isAdmin = false;
  process.env.LOVABLE_API_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("scanClientFromImage admin gate", () => {
  it("rejects non-admin users and never calls the AI gateway", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      scanClientFromImageHandler(validInput, { userId: "non-admin" }),
    ).rejects.toThrow(/Forbidden/);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows admin users and calls the AI gateway", async () => {
    isAdmin = true;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"full_name":"Иван","raw_text":"x"}' } }],
      }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock as any);

    const out = await scanClientFromImageHandler(validInput, { userId: "admin-1" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(out).toEqual({ ok: true, data: { full_name: "Иван", raw_text: "x" } });
  });
});
