import { describe, expect, it } from "vitest";
import {
  BLANK,
  buildFillValues,
  fillPlaceholders,
  listUnfilled,
  suggestedTitle,
} from "./contracts";

describe("contract placeholder merge", () => {
  it("fills Latin and Bulgarian aliases from client + property", () => {
    const values = buildFillValues({
      client: { full_name: "Иван Петров", phone: "0888123456", city: "Шумен" },
      property: {
        title: "Тристаен център",
        price: 120000,
        currency: "EUR",
        area_sqm: 82,
        city: "Шумен",
        address: "ул. Славянска 1",
      },
    });
    const text = fillPlaceholders(
      "Клиент {{име}}, имот {{имот}}, цена {{цена}}, площ {{площ}} кв.м, град {{град}}, адрес {{адрес}}.",
      values,
    );
    expect(text).toContain("Иван Петров");
    expect(text).toContain("Тристаен център");
    expect(text).toContain("120");
    expect(text).toContain("82");
    expect(text).toContain("Шумен");
    expect(text).toContain("ул. Славянска 1");
    expect(listUnfilled(text)).toHaveLength(0);
  });

  it("keeps blanks when data is missing", () => {
    const values = buildFillValues({});
    const text = fillPlaceholders("ЕГН {{егн}} / собственик {{собственик}}", values);
    expect(text).toBe(`ЕГН ${BLANK} / собственик ${BLANK}`);
    expect(listUnfilled(text).length).toBeGreaterThan(0);
  });

  it("builds a short title", () => {
    expect(suggestedTitle("Предварителен договор", "Иван", "Апартамент")).toBe(
      "Предварителен договор — Иван — Апартамент",
    );
  });
});
