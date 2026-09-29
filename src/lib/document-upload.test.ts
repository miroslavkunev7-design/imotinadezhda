import { describe, expect, it } from "vitest";

import {
  documentAccept,
  safeDocumentFileName,
  validateDocumentUpload,
} from "@/lib/document-upload";

const file = (overrides: Partial<Pick<File, "name" | "size" | "type">> = {}) => ({
  name: "договор.pdf",
  size: 1024,
  type: "application/pdf",
  ...overrides,
});

describe("validateDocumentUpload", () => {
  it("accepts a pdf within the limit", () => {
    expect(validateDocumentUpload(file(), 10)).toBeNull();
  });

  it("rejects an empty file, an oversized file, and a mismatched type", () => {
    expect(validateDocumentUpload(file({ size: 0 }), 10)).toMatch(/празен/);
    expect(validateDocumentUpload(file({ size: 11 * 1024 * 1024 }), 10)).toMatch(/по-голям/);
    expect(validateDocumentUpload(file({ name: "scan.pdf", type: "image/png" }), 10)).toMatch(
      /не съответства/,
    );
    expect(validateDocumentUpload(file({ name: "notes.txt", type: "text/plain" }), 10)).toMatch(
      /Неподдържан/,
    );
  });

  it("builds an accept list and a storage-safe name", () => {
    expect(documentAccept("pdf, jpg")).toBe(".pdf,.jpg");
    expect(safeDocumentFileName("скан договор (финал).pdf")).toBe("скан_договор_финал.pdf");
    expect(safeDocumentFileName("///")).toBe("document");
  });
});
