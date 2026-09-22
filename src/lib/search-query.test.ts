import { describe, expect, it } from "vitest";

import { ANY, buildSearchQuery, type SearchFilters } from "@/lib/search-query";

const defaults: SearchFilters = {
  city: ANY,
  type: ANY,
  price: ANY,
  area: ANY,
  status: ANY,
};

describe("buildSearchQuery", () => {
  it("omits unset filters", () => {
    expect(buildSearchQuery(defaults)).toEqual({});
  });

  it("keeps city, type, status, and closed ranges aligned with /search", () => {
    expect(
      buildSearchQuery({
        city: "shumen",
        type: "apartment",
        price: "100000-200000",
        area: "60-100",
        status: "sale",
      }),
    ).toEqual({
      city_slug: "shumen",
      property_type: "apartment",
      status: "sale",
      price_min: "100000",
      price_max: "200000",
      area_min: "60",
      area_max: "100",
    });
  });

  it("supports open-ended price and area ranges", () => {
    expect(
      buildSearchQuery({ ...defaults, price: "500000-", area: "0-60" }),
    ).toEqual({ price_min: "500000", area_min: "0", area_max: "60" });
  });
});
