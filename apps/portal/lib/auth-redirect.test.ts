import { describe, expect, it } from "vitest";
import { safeApplicationRedirect } from "./auth-redirect";

const applications = {
  portal: "https://hub.example.test",
  precifica: "https://precifica.example.test",
  proposta: "https://proposta.example.test",
};

describe("safeApplicationRedirect", () => {
  it("keeps navigation within the three configured applications", () => {
    expect(
      safeApplicationRedirect("https://proposta.example.test/?from=login", applications),
    ).toBe("https://proposta.example.test/?from=login");
  });

  it("rejects arbitrary and malformed redirect targets", () => {
    expect(safeApplicationRedirect("https://evil.example.test", applications)).toBe("/");
    expect(safeApplicationRedirect("http://[", applications)).toBe("/");
  });
});
