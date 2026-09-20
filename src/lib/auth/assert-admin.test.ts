import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the admin database client, including the role/access RPCs used by the
// shared CRM gate. The role query returns the value configured per test.
let mockData: { role: string } | null = null;

vi.mock("@/integrations/supabase/client.server", () => {
  const roleBuilder = {
    select: vi.fn(() => ({
      eq: vi.fn(async () => ({ data: mockData ? [mockData] : [], error: null })),
    })),
  };
  const brokerBuilder = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      })),
    })),
  };
  return {
    supabaseAdmin: {
      from: vi.fn((table: string) => (table === "user_roles" ? roleBuilder : brokerBuilder)),
      rpc: vi.fn(async (name: string) => ({
        data: name === "is_full_access" ? false : null,
        error: null,
      })),
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
    await expect(assertAdmin("user-1")).resolves.toMatchObject({ isAdmin: true });
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
