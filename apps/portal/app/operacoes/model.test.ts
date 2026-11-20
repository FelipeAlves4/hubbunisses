import { describe, expect, it } from "vitest";
import { isLate, isOpen, orderNumber, parseAmount, progress } from "./model";

describe("OPERA+ operational indicators", () => {
  it("counts late orders only while open and after the deadline", () => {
    expect(isLate({ status: "waiting", due_date: "2026-11-19" }, "2026-11-20")).toBe(true);
    expect(isLate({ status: "in_progress", due_date: "2026-11-20" }, "2026-11-20")).toBe(false);
    expect(isLate({ status: "pending", due_date: null }, "2026-11-20")).toBe(false);
    expect(isLate({ status: "completed", due_date: "2026-11-19" }, "2026-11-20")).toBe(false);
    expect(isOpen({ status: "cancelled" })).toBe(false);
  });

  it("derives checklist progress after completion, reopening and removal", () => {
    expect(progress([])).toBe(0);
    expect(progress([{ done: true }, { done: false }, { done: false }])).toBe(33);
    expect(progress([{ done: false }, { done: false }])).toBe(0);
    expect(progress([{ done: true }])).toBe(100);
  });

  it("passes money as an exact decimal string within the database range", () => {
    expect(parseAmount("999999999999,99")).toBe("999999999999.99");
    expect(parseAmount("0")).toBe("0");
    expect(parseAmount("")).toBeNull();
    for (const invalid of ["-1", "1e4", "1.001", "1234567890123", "1.000,00"]) {
      expect(() => parseAmount(invalid)).toThrow();
    }
  });

  it("formats generated numbers without cutting off longer sequences", () => {
    expect(orderNumber(1)).toBe("OS-00001");
    expect(orderNumber(123456)).toBe("OS-123456");
  });
});
