export type CostComposition = { label: string; amount: number };

export type PricingResult = {
  totalCost: number;
  variableRate: number;
  priceFloor: number;
  recommendedPrice: number;
  grossProfitPerUnit: number;
  estimatedMarginRate: number;
  markup: number;
  composition: CostComposition[];
};

export class PricingInputError extends Error {}

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function assertFiniteNonNegative(label: string, value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new PricingInputError(`${label} deve ser um valor não negativo.`);
  }
}

export function assertRate(label: string, value: number) {
  assertFiniteNonNegative(label, value);
  if (value > 1) {
    throw new PricingInputError(`${label} deve ser informado entre 0% e 100%.`);
  }
}

export function calculatePricingResult({
  composition,
  commissionRate,
  taxRate,
  paymentFeeRate,
  desiredMarginRate,
}: {
  composition: CostComposition[];
  commissionRate: number;
  taxRate: number;
  paymentFeeRate: number;
  desiredMarginRate: number;
}): PricingResult {
  composition.forEach(({ label, amount }) => assertFiniteNonNegative(label, amount));
  const rates: Array<[string, number]> = [
    ["Comissões", commissionRate],
    ["Tributos", taxRate],
    ["Taxas de pagamento", paymentFeeRate],
    ["Margem desejada", desiredMarginRate],
  ];
  rates.forEach(([label, rate]) => assertRate(label, rate));

  const totalCost = composition.reduce((total, item) => total + item.amount, 0);
  const variableRate = commissionRate + taxRate + paymentFeeRate;
  const denominator = 1 - variableRate - desiredMarginRate;
  const floorDenominator = 1 - variableRate;
  if (denominator <= 0) {
    throw new PricingInputError("A soma de tributos, taxas, comissões e margem deve ser menor que 100%.");
  }
  if (floorDenominator <= 0) {
    throw new PricingInputError("A soma de tributos, taxas e comissões deve ser menor que 100%.");
  }

  const recommendedPrice = roundMoney(totalCost / denominator);
  const priceFloor = roundMoney(totalCost / floorDenominator);
  const grossProfitPerUnit = roundMoney(recommendedPrice - totalCost - recommendedPrice * variableRate);
  const estimatedMarginRate = recommendedPrice === 0 ? 0 : grossProfitPerUnit / recommendedPrice;
  const markup = totalCost === 0 ? 0 : recommendedPrice / totalCost;

  return {
    totalCost: roundMoney(totalCost),
    variableRate,
    priceFloor,
    recommendedPrice,
    grossProfitPerUnit,
    estimatedMarginRate,
    markup: Math.round(markup * 1000) / 1000,
    composition: composition.map(({ label, amount }) => ({ label, amount: roundMoney(amount) })),
  };
}
