import { assertFiniteNonNegative, assertRate, roundMoney } from "./core";

export type ScenarioInput = {
  totalCost: number;
  variableRate: number;
  desiredMarginRate: number;
  recommendedPrice: number;
  customPrice?: number;
  discountRate?: number;
  costVariationRate?: number;
};

export type SaleScenario = {
  price: number;
  profit: number;
  effectiveMarginRate: number;
  differenceFromSuggested: number;
  differenceFromBalance: number;
};

export type PricingScenarios = {
  customSale?: SaleScenario;
  discount?: SaleScenario & { profitReduction: number; discountAmount: number };
  costVariation?: {
    newTotalCost: number;
    profitAtCurrentPrice: number;
    effectiveMarginRate: number;
    requiredPrice: number;
  };
};

function saleScenario(price: number, totalCost: number, variableRate: number, recommendedPrice: number): SaleScenario {
  const profit = roundMoney(price - totalCost - price * variableRate);
  const priceFloor = variableRate >= 1 ? Infinity : totalCost / (1 - variableRate);
  return {
    price: roundMoney(price),
    profit,
    effectiveMarginRate: price === 0 ? 0 : profit / price,
    differenceFromSuggested: roundMoney(price - recommendedPrice),
    differenceFromBalance: roundMoney(price - priceFloor),
  };
}

export function calculatePricingScenarios(input: ScenarioInput): PricingScenarios {
  assertFiniteNonNegative("Custo total", input.totalCost);
  assertFiniteNonNegative("Preço recomendado", input.recommendedPrice);
  assertRate("Taxas variáveis", input.variableRate);
  assertRate("Margem desejada", input.desiredMarginRate);
  const result: PricingScenarios = {};
  if (input.customPrice !== undefined) {
    assertFiniteNonNegative("Preço de venda", input.customPrice);
    result.customSale = saleScenario(input.customPrice, input.totalCost, input.variableRate, input.recommendedPrice);
  }
  if (input.discountRate !== undefined) {
    assertRate("Desconto", input.discountRate);
    const discountedPrice = input.recommendedPrice * (1 - input.discountRate);
    const scenario = saleScenario(discountedPrice, input.totalCost, input.variableRate, input.recommendedPrice);
    result.discount = {
      ...scenario,
      discountAmount: roundMoney(input.recommendedPrice - discountedPrice),
      profitReduction: roundMoney(input.recommendedPrice - input.totalCost - input.recommendedPrice * input.variableRate - scenario.profit),
    };
  }
  if (input.costVariationRate !== undefined) {
    assertFiniteNonNegative("Variação de custo", input.costVariationRate + 1);
    const newTotalCost = input.totalCost * (1 + input.costVariationRate);
    const profitAtCurrentPrice = roundMoney(input.recommendedPrice - newTotalCost - input.recommendedPrice * input.variableRate);
    const denominator = 1 - input.variableRate - input.desiredMarginRate;
    if (denominator <= 0) {
      throw new Error("Não há preço viável para a margem e taxas informadas.");
    }
    result.costVariation = {
      newTotalCost: roundMoney(newTotalCost),
      profitAtCurrentPrice,
      effectiveMarginRate: input.recommendedPrice === 0 ? 0 : profitAtCurrentPrice / input.recommendedPrice,
      requiredPrice: roundMoney(newTotalCost / denominator),
    };
  }
  return result;
}
