import { describe, expect, it } from "vitest";
import { formatDocumentNumber, normalizeDocumentNumber, toClientValues } from "./client-input";

describe("client document input", () => {
  it("allows a basic client registration with only a name and persists null optional fields", () => {
    expect(normalizeDocumentNumber("", "individual")).toBeNull();
    expect(normalizeDocumentNumber("   ", "company")).toBeNull();
    expect(toClientValues({ name: "Cliente básico", type: "company" })).toMatchObject({
      name: "Cliente básico",
      document_number: null,
      contact_name: null,
      email: null,
      phone: null,
      address: null,
      notes: null,
    });
  });

  it("formats valid CPF and CNPJ values", () => {
    expect(formatDocumentNumber("52998224725", "individual")).toBe("529.982.247-25");
    expect(normalizeDocumentNumber("529.982.247-25", "individual")).toBe("529.982.247-25");
    expect(formatDocumentNumber("04252011000110", "company")).toBe("04.252.011/0001-10");
    expect(normalizeDocumentNumber("04.252.011/0001-10", "company")).toBe("04.252.011/0001-10");
  });

  it("rejects an invalid document when one is supplied", () => {
    expect(() => normalizeDocumentNumber("123.456.789-00", "individual")).toThrow("CPF inválido.");
    expect(() => normalizeDocumentNumber("12.345.678/0001-00", "company")).toThrow("CNPJ inválido.");
  });
});
