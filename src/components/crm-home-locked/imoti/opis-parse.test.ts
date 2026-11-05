import { describe, expect, it } from "vitest";

import { parsePriceFromFolderName } from "./folder-ingest";
import { AGENCY_PUBLIC_PHONE } from "./imoti-types";
import {
  buildLocalOfficialDescription,
  parseOpisText,
  replacePhonesForPublic,
  resolveCityFromQuarter,
  scrubExactAddress,
} from "./opis-parse";

describe("parsePriceFromFolderName", () => {
  it("parses plain number", () => {
    expect(parsePriceFromFolderName("85000").price).toBe(85000);
  });

  it("parses spaced euro", () => {
    expect(parsePriceFromFolderName("85 000 евро").price).toBe(85000);
    expect(parsePriceFromFolderName("85 000 евро").currency).toBe("EUR");
  });

  it("parses 85к", () => {
    expect(parsePriceFromFolderName("85к").price).toBe(85000);
  });
});

describe("parseOpisText", () => {
  it("splits owner price from personal description and phones", () => {
    const parsed = parseOpisText(
      "Двустаен, кв. Боян Българанов, 64 кв.м, етаж 3/5. Собственикът иска 78 000. Тел. 0888123456",
    );
    expect(parsed.ownerPrice).toBe(78000);
    expect(parsed.areaSqm).toBe(64);
    expect(parsed.floor).toBe("3/5");
    expect(parsed.quarter?.toLowerCase()).toContain("боян");
    expect(parsed.city).toBe("Шумен");
    expect(parsed.phones.some((p) => p.includes("0888123456"))).toBe(true);
    expect(parsed.personalDescription).toContain("Собственикът иска");
  });
});

describe("public description rules", () => {
  it("replaces phones with agency number", () => {
    const out = replacePhonesForPublic("Обадете се на 0888123456 веднага");
    expect(out).toContain(AGENCY_PUBLIC_PHONE);
    expect(out).not.toContain("0888123456");
  });

  it("scrubs street address", () => {
    const out = scrubExactAddress("Имот на ул. Васил Левски 12 в центъра");
    expect(out.toLowerCase()).not.toContain("васил");
  });

  it("builds official description without inventing facts", () => {
    const text = buildLocalOfficialDescription({
      typeLabel: "двустаен",
      areaSqm: 64,
      floor: "3/5",
      city: "Шумен",
      quarter: "Боян Българанов",
      personalDescription: "ул. Тестова 5, тел 0888123456, тухла",
    });
    expect(text).toContain("64");
    expect(text).toContain("Шумен");
    expect(text).toContain(AGENCY_PUBLIC_PHONE);
    expect(text.toLowerCase()).not.toContain("тестова");
  });
});

describe("resolveCityFromQuarter", () => {
  it("maps known unique quarter", () => {
    expect(resolveCityFromQuarter("Боян Българанов")).toBe("Шумен");
  });

  it("leaves ambiguous empty", () => {
    expect(resolveCityFromQuarter("Център")).toBe("");
  });
});
