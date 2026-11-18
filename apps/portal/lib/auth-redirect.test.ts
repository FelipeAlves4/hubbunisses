import { describe, expect, it } from "vitest";
import { safeApplicationRedirect } from "./auth-redirect";

const applications = {
  portal: "https://hub.example.test",
  precifica: "https://precifica.example.test",
  proposta: "https://proposta.example.test",
};

describe("safeApplicationRedirect", () => {
  it("keeps internal navigation on the current Portal origin", () => {
    expect(
      safeApplicationRedirect("/proposta?from=login", applications),
    ).toBe("/proposta?from=login");
    expect(
      safeApplicationRedirect("https://hub.example.test/precifica", applications),
    ).toBe("/precifica");
  });

  it("rejects cross-origin, protocol-relative, and malformed redirect targets", () => {
    expect(safeApplicationRedirect("https://evil.example.test", applications)).toBe("/");
    expect(safeApplicationRedirect("https://proposta.example.test", applications)).toBe("/");
    expect(safeApplicationRedirect("//evil.example.test", applications)).toBe("/");
    expect(safeApplicationRedirect("/\\evil.example.test", applications)).toBe("/");
    expect(safeApplicationRedirect("http://[", applications)).toBe("/");
  });
});
