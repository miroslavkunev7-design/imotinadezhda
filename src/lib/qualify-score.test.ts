import { describe, expect, it } from "vitest";
import {
  extractFromFreeText,
  mergeExtractionIntoClient,
  parseAiQualificationJson,
  scoreClient,
  scoreInquiry,
  scoreToTier,
  tierLabel,
} from "./qualify-score";

describe("qualify-score", () => {
  it("maps score bands to hot/warm/cold", () => {
    expect(scoreToTier(90)).toBe("hot");
    expect(scoreToTier(70)).toBe("hot");
    expect(scoreToTier(40)).toBe("warm");
    expect(scoreToTier(39)).toBe("cold");
    expect(tierLabel("hot")).toBe("Горещ");
  });

  it("scores a complete buyer higher than an empty profile", () => {
    const hot = scoreClient({
      phone: "+359888111222",
      email: "a@b.bg",
      client_type: "buyer",
      search_city_id: "city-1",
      search_quarter_id: "q-1",
      search_property_type: "apartment",
      search_status: "sale",
      budget_min: 80000,
      budget_max: 140000,
      currency: "EUR",
      notes: "Търси двустаен в Лазур, спешно за семейството.",
      assigned_broker_id: "broker-1",
      match_count: 2,
      inquiry_count: 1,
      urgency: "high",
      updated_at: new Date().toISOString(),
    });
    const cold = scoreClient({
      full_name: "X",
      client_type: "buyer",
    } as any);
    expect(hot.score).toBeGreaterThanOrEqual(70);
    expect(hot.tier).toBe("hot");
    expect(cold.score).toBeLessThan(hot.score);
    expect(hot.breakdown.budget).toBeGreaterThan(0);
    expect(hot.breakdown.area).toBe(20);
  });

  it("extracts budget, city and urgency from Bulgarian notes", () => {
    const ex = extractFromFreeText(
      "Купувам двустаен в Бургас, бюджет от 90000 до 130000 евро, спешно тази седмица.",
    );
    expect(ex.city_name).toBe("Бургас");
    expect(ex.client_type).toBe("buyer");
    expect(ex.search_property_type).toBe("apartment");
    expect(ex.budget_min).toBe(90000);
    expect(ex.budget_max).toBe(130000);
    expect(ex.currency).toBe("EUR");
    expect(ex.urgency).toBe("high");
    expect(ex.rooms_min).toBe(2);
  });

  it("does not overwrite existing client budget when merging AI fields", () => {
    const patch = mergeExtractionIntoClient(
      { budget_min: 50000, budget_max: 60000, search_city_id: null },
      {
        budget_min: 1,
        budget_max: 2,
        currency: "EUR",
        city_name: "Варна",
        quarter_name: null,
        client_type: "buyer",
        search_status: "sale",
        search_property_type: "house",
        rooms_min: null,
        rooms_max: null,
        urgency: null,
        intent_summary: null,
      },
      { city_id: "varna-id", quarter_id: null },
    );
    expect(patch.budget_min).toBeUndefined();
    expect(patch.budget_max).toBeUndefined();
    expect(patch.search_city_id).toBe("varna-id");
  });

  it("parses AI JSON even with markdown fences", () => {
    const parsed = parseAiQualificationJson('```json\n{"budget_max": 120000, "city_name": "Шумен", "urgency": "medium"}\n```');
    expect(parsed?.budget_max).toBe(120000);
    expect(parsed?.city_name).toBe("Шумен");
    expect(parsed?.urgency).toBe("medium");
  });

  it("scores inquiries with a property and phone as warmer leads", () => {
    const scored = scoreInquiry({
      phone: "0888123456",
      email: "x@y.bg",
      message: "Здравейте, интересувам се от този имот в Варна, бюджет до 150000 евро, спешно.",
      property_id: "prop-1",
      status: "new",
    });
    expect(scored.score).toBeGreaterThanOrEqual(40);
    expect(scored.urgency).toBe("high");
  });
});
