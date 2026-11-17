import { describe, expect, it } from "vitest";
import { calculateProposalTotals, lineTotal } from "./proposal-math";

describe("proposal totals", () => {
  it("calculates line discounts, additions and taxes with cent precision", () => {
    expect(
      lineTotal({ quantity: 3, unitPrice: 19.99, discountAmount: 0.02 }),
    ).toBe(59.95);
    expect(
      calculateProposalTotals({
        items: [
          { quantity: 3, unitPrice: 19.99, discountAmount: 0.02 },
          { quantity: 1, unitPrice: 100 },
        ],
        additionalTotal: 10,
        taxRate: 5,
      }),
    ).toEqual({
      subtotal: 159.95,
      discountTotal: 0.02,
      additionalTotal: 10,
      taxTotal: 8.5,
      grandTotal: 178.45,
    });
  });
  it("rejects invalid monetary input instead of silently producing invalid totals", () => {
    expect(() =>
      calculateProposalTotals({ items: [{ quantity: 1, unitPrice: -1 }] }),
    ).toThrow();
    expect(() =>
      calculateProposalTotals({ items: [], taxRate: 101 }),
    ).toThrow();
    expect(() => lineTotal({ quantity: 0, unitPrice: 10 })).toThrow();
    expect(() =>
      calculateProposalTotals({
        items: [{ quantity: 1, unitPrice: 10, discountAmount: 10.01 }],
      }),
    ).toThrow();
  });
});
