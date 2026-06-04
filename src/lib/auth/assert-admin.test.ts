import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the admin Supabase client. The terminal call (.maybeSingle) returns
// the value we set per-test via `mockData`.
let mockData: { role: string } | null = null;

vi.mock("@/integrations/supabase/client.server", () => {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: mockData, error: null })),
  };
  return {
    supabaseAdmin: {
      from: vi.fn(() => builder),
    },
  };
});

import { assertAdmin } from "./assert-admin";

beforeEach(() => {
  mockData = null;
});

describe("assertAdmin", () => {
  it("resolves when the user has the admin role", async () => {
    mockData = { role: "admin" };
    await expect(assertAdmin("user-1")).resolves.toBeUndefined();
  });

  it("throws Forbidden when the user has no admin row", async () => {
    mockData = null;
    await expect(assertAdmin("user-2")).rejects.toThrow(/Forbidden/);
  });

  it("throws for the empty-string user id (defensive)", async () => {
    mockData = null;
    await expect(assertAdmin("")).rejects.toThrow(/Forbidden/);
  });
});
