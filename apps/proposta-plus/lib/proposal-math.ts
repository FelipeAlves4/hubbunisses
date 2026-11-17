export type ProposalLineInput = {
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
};
export type ProposalTotalsInput = {
  items: ProposalLineInput[];
  additionalTotal?: number;
  taxRate?: number;
};
export type ProposalTotals = {
  subtotal: number;
  discountTotal: number;
  additionalTotal: number;
  taxTotal: number;
  grandTotal: number;
};

const cents = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
const amount = (value: number, name: string) => {
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`${name} deve ser um valor positivo.`);
  return value;
};

export function lineTotal({
  quantity,
  unitPrice,
  discountAmount = 0,
}: ProposalLineInput) {
  if (!Number.isFinite(quantity) || quantity <= 0)
    throw new Error("Quantidade deve ser maior que zero.");
  amount(unitPrice, "Valor unitário");
  amount(discountAmount, "Desconto");
  const gross = cents(quantity * unitPrice);
  if (discountAmount > gross)
    throw new Error("Desconto não pode ser maior que o total do item.");
  return cents(gross - discountAmount);
}

export function calculateProposalTotals({
  items,
  additionalTotal = 0,
  taxRate = 0,
}: ProposalTotalsInput): ProposalTotals {
  amount(additionalTotal, "Acréscimos");
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100)
    throw new Error("Tributos devem ficar entre 0 e 100%.");
  const gross = cents(
    items.reduce(
      (sum, item) =>
        sum +
        cents(
          amount(item.quantity, "Quantidade") *
            amount(item.unitPrice, "Valor unitário"),
        ),
      0,
    ),
  );
  const discountTotal = cents(
    items.reduce(
      (sum, item) => sum + amount(item.discountAmount ?? 0, "Desconto"),
      0,
    ),
  );
  if (discountTotal > gross)
    throw new Error("Desconto não pode ser maior que o total dos itens.");
  const subtotal = cents(Math.max(0, gross - discountTotal));
  const taxTotal = cents((subtotal + additionalTotal) * (taxRate / 100));
  return {
    subtotal,
    discountTotal,
    additionalTotal: cents(additionalTotal),
    taxTotal,
    grandTotal: cents(subtotal + additionalTotal + taxTotal),
  };
}

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
