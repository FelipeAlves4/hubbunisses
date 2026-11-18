import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./index.js";

describe("safeInternalPath", () => {
  it("keeps internal paths, including their query and hash", () => {
    expect(safeInternalPath("/propostas?status=draft#items")).toBe(
      "/propostas?status=draft#items",
    );
  });

  it("rejects external, protocol-relative, and malformed destinations", () => {
    expect(safeInternalPath("https://evil.example.test")).toBe("/");
    expect(safeInternalPath("//evil.example.test")).toBe("/");
    expect(safeInternalPath("http://[")).toBe("/");
  });
});
