import { calculatePricingResult, type PricingResult } from "./core";

export type ServicePricingInput = {
  name: string;
  description?: string;
  category?: string;
  estimatedHours: number;
  hourlyCost: number;
  professionalCount: number;
  materialsCost: number;
  travelCost: number;
  outsourcingCost: number;
  otherDirectCosts: number;
  fixedExpenseAllocated: number;
  commissionRate: number;
  taxRate: number;
  paymentFeeRate: number;
  desiredMarginRate: number;
};

export type ServicePricingResult = PricingResult & { laborCost: number };

export function calculateServicePrice(input: ServicePricingInput): ServicePricingResult {
  const laborCost = input.estimatedHours * input.hourlyCost * input.professionalCount;
  const result = calculatePricingResult({
    composition: [
      { label: "Mão de obra", amount: laborCost },
      { label: "Materiais e insumos", amount: input.materialsCost },
      { label: "Deslocamento", amount: input.travelCost },
      { label: "Terceirizações", amount: input.outsourcingCost },
      { label: "Outros custos diretos", amount: input.otherDirectCosts },
      { label: "Despesas fixas alocadas", amount: input.fixedExpenseAllocated },
    ],
    commissionRate: input.commissionRate,
    taxRate: input.taxRate,
    paymentFeeRate: input.paymentFeeRate,
    desiredMarginRate: input.desiredMarginRate,
  });
  return { ...result, laborCost };
}
