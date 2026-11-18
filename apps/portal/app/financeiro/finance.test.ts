import { describe, expect, it } from "vitest";
import {
  calculateDashboard,
  filterTransactions,
  isOverdue,
  parseCurrencyToCents,
  type FinanceTransaction,
} from "./finance";

const records: FinanceTransaction[] = [
  { id: "1", categoryId: "c1", categoryName: "Vendas", entryType: "income", description: "Venda recebida", amountCents: 125_050, issuedAt: "2026-11-02", dueDate: "2026-11-10", paidAt: "2026-11-08", status: "paid", notes: null },
  { id: "2", categoryId: "c2", categoryName: "Software", entryType: "expense", description: "Assinatura", amountCents: 19_990, issuedAt: "2026-11-03", dueDate: "2026-11-09", paidAt: "2026-11-09", status: "paid", notes: null },
  { id: "3", categoryId: "c1", categoryName: "Vendas", entryType: "income", description: "Venda prevista", amountCents: 80_000, issuedAt: "2026-11-07", dueDate: "2026-11-22", paidAt: null, status: "pending", notes: null },
  { id: "4", categoryId: "c3", categoryName: "Fornecedores", entryType: "expense", description: "Material previsto", amountCents: 35_000, issuedAt: "2026-11-06", dueDate: "2026-11-18", paidAt: null, status: "pending", notes: null },
];

describe("NEXO Finance calculations", () => {
  it("parses Brazilian currency into exact integer cents", () => {
    expect(parseCurrencyToCents("1.250,50")).toBe(125_050);
    expect(parseCurrencyToCents("19.99")).toBe(1_999);
    expect(parseCurrencyToCents("0")).toBeNull();
    expect(parseCurrencyToCents("1,999")).toBeNull();
  });

  it("keeps forecasts out of realized balance", () => {
    expect(calculateDashboard(records, { from: "2026-11-01", to: "2026-11-30" })).toEqual({
      receivedCents: 125_050,
      paidCents: 19_990,
      realizedBalanceCents: 105_060,
      receivableCents: 80_000,
      payableCents: 35_000,
    });
  });

  it("derives overdue from due date instead of persisting it", () => {
    expect(isOverdue(records[3], "2026-11-19")).toBe(true);
    expect(isOverdue(records[3], "2026-11-18")).toBe(false);
    expect(isOverdue(records[1], "2026-12-01")).toBe(false);
  });

  it("filters history independently from dashboard realization", () => {
    const result = filterTransactions(records, {
      from: "2026-11-01", to: "2026-11-30", type: "expense", categoryId: "all", status: "pending",
    }, "2026-11-12");
    expect(result.map((record) => record.id)).toEqual(["4"]);
  });
});
