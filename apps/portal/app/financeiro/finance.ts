export type FinanceEntryType = "income" | "expense";
export type FinanceStatus = "pending" | "paid";
export type FinanceCategoryKind = FinanceEntryType | "both";

export type FinanceCategory = {
  id: string;
  name: string;
  kind: FinanceCategoryKind;
};

export type FinanceTransaction = {
  id: string;
  categoryId: string;
  categoryName: string;
  entryType: FinanceEntryType;
  description: string;
  amountCents: number;
  issuedAt: string;
  dueDate: string;
  paidAt: string | null;
  status: FinanceStatus;
  notes: string | null;
};

export type FinanceFilters = {
  from: string;
  to: string;
  type: FinanceEntryType | "all";
  categoryId: string | "all";
  status: FinanceStatus | "overdue" | "all";
};

export type FinanceDashboard = {
  receivedCents: number;
  paidCents: number;
  realizedBalanceCents: number;
  receivableCents: number;
  payableCents: number;
};

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrency(cents: number) {
  return BRL.format(cents / 100);
}

export function localIsoDate(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

export function monthBounds(date = new Date()) {
  const from = new Date(date.getFullYear(), date.getMonth(), 1);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { from: localIsoDate(from), to: localIsoDate(to) };
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isOverdue(
  transaction: Pick<FinanceTransaction, "status" | "dueDate">,
  asOf = localIsoDate(),
) {
  return transaction.status === "pending" && transaction.dueDate < asOf;
}

export function parseCurrencyToCents(value: string): number | null {
  const normalized = value.trim().replace(/R\$|\s/g, "");
  if (!normalized) return null;
  const withoutThousands = normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized;
  if (!/^\d+(\.\d{1,2})?$/.test(withoutThousands)) return null;
  const [whole, decimal = ""] = withoutThousands.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function filterTransactions(
  transactions: FinanceTransaction[],
  filters: FinanceFilters,
  asOf = localIsoDate(),
) {
  return transactions.filter((transaction) => {
    const inPeriod = transaction.issuedAt >= filters.from && transaction.issuedAt <= filters.to;
    const typeMatches = filters.type === "all" || transaction.entryType === filters.type;
    const categoryMatches = filters.categoryId === "all" || transaction.categoryId === filters.categoryId;
    const status = isOverdue(transaction, asOf) ? "overdue" : transaction.status;
    const statusMatches = filters.status === "all" || filters.status === status;
    return inPeriod && typeMatches && categoryMatches && statusMatches;
  });
}

export function calculateDashboard(
  transactions: FinanceTransaction[],
  period: Pick<FinanceFilters, "from" | "to">,
) : FinanceDashboard {
  let receivedCents = 0;
  let paidCents = 0;
  let receivableCents = 0;
  let payableCents = 0;
  for (const transaction of transactions) {
    if (transaction.status === "paid" && transaction.paidAt && transaction.paidAt >= period.from && transaction.paidAt <= period.to) {
      if (transaction.entryType === "income") receivedCents += transaction.amountCents;
      else paidCents += transaction.amountCents;
    }
    if (transaction.status === "pending" && transaction.dueDate >= period.from && transaction.dueDate <= period.to) {
      if (transaction.entryType === "income") receivableCents += transaction.amountCents;
      else payableCents += transaction.amountCents;
    }
  }
  return {
    receivedCents,
    paidCents,
    realizedBalanceCents: receivedCents - paidCents,
    receivableCents,
    payableCents,
  };
}

export function categoryFitsType(category: FinanceCategory, entryType: FinanceEntryType) {
  return category.kind === "both" || category.kind === entryType;
}
