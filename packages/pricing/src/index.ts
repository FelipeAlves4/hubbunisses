import { calculatePricingResult, type PricingResult } from "./core";

export type ProductPricingInput = {
  name: string;
  acquisitionCost: number;
  packagingCost: number;
  freightPerUnit: number;
  otherDirectCosts: number;
  fixedExpensePerUnit: number;
  commissionRate: number;
  taxRate: number;
  paymentFeeRate: number;
  desiredMarginRate: number;
};

export type ProductPricingResult = PricingResult;

/** Calculates product prices from unit costs. All percentages are decimal rates. */
export function calculateProductPrice(input: ProductPricingInput): ProductPricingResult {
  return calculatePricingResult({
    composition: [
      { label: "Custo de aquisição", amount: input.acquisitionCost },
      { label: "Embalagem", amount: input.packagingCost },
      { label: "Frete", amount: input.freightPerUnit },
      { label: "Outros custos", amount: input.otherDirectCosts },
      { label: "Despesas fixas", amount: input.fixedExpensePerUnit },
    ],
    commissionRate: input.commissionRate,
    taxRate: input.taxRate,
    paymentFeeRate: input.paymentFeeRate,
    desiredMarginRate: input.desiredMarginRate,
  });
}

export { PricingInputError } from "./core";
export type { CostComposition, PricingResult } from "./core";
export { calculateServicePrice } from "./service";
export type { ServicePricingInput, ServicePricingResult } from "./service";
export { calculatePricingScenarios } from "./scenarios";
export type { PricingScenarios, SaleScenario, ScenarioInput } from "./scenarios";
