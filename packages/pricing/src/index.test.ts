import { describe, expect, it } from "vitest";
import { calculatePricingScenarios, calculateProductPrice, calculateServicePrice, PricingInputError } from "./index.js";

const base = { name: "Café", acquisitionCost: 40, packagingCost: 2, freightPerUnit: 3, otherDirectCosts: 5, fixedExpensePerUnit: 10, commissionRate: 0.05, taxRate: 0.08, paymentFeeRate: 0.02, desiredMarginRate: 0.2 };

describe("calculateProductPrice", () => {
  it("calculates margin on revenue rather than markup", () => {
    const result = calculateProductPrice(base);
    expect(result.totalCost).toBe(60);
    expect(result.recommendedPrice).toBe(92.31);
    expect(result.estimatedMarginRate).toBeCloseTo(0.2, 2);
    expect(result.markup).toBeCloseTo(1.539, 3);
  });
  it("supports zero costs without a NaN result", () => {
    expect(calculateProductPrice({ ...base, acquisitionCost: 0, packagingCost: 0, freightPerUnit: 0, otherDirectCosts: 0, fixedExpensePerUnit: 0 }).recommendedPrice).toBe(0);
  });
  it("rejects invalid percentage combinations", () => {
    expect(() => calculateProductPrice({ ...base, taxRate: 0.6, desiredMarginRate: 0.4 })).toThrow(PricingInputError);
  });
  it("rejects negative monetary values", () => {
    expect(() => calculateProductPrice({ ...base, freightPerUnit: -1 })).toThrow("Frete deve ser um valor não negativo.");
  });
});

describe("calculateServicePrice", () => {
  const service = {
    name: "Instalação elétrica", estimatedHours: 10, hourlyCost: 50, professionalCount: 2,
    materialsCost: 100, travelCost: 40, outsourcingCost: 60, otherDirectCosts: 0, fixedExpenseAllocated: 50,
    commissionRate: 0.05, taxRate: 0.1, paymentFeeRate: 0.02, desiredMarginRate: 0.2,
  };

  it("includes labor and all allocated service costs", () => {
    const result = calculateServicePrice(service);
    expect(result.laborCost).toBe(1000);
    expect(result.totalCost).toBe(1250);
    expect(result.recommendedPrice).toBe(1984.13);
    expect(result.estimatedMarginRate).toBeCloseTo(0.2, 2);
  });

  it("validates service labor entries", () => {
    expect(() => calculateServicePrice({ ...service, professionalCount: -1 })).toThrow(PricingInputError);
  });
});

describe("calculatePricingScenarios", () => {
  const baseScenario = { totalCost: 100, variableRate: 0.1, desiredMarginRate: 0.2, recommendedPrice: 142.86 };

  it("calculates a custom sale against the suggested and break-even prices", () => {
    const scenarios = calculatePricingScenarios({ ...baseScenario, customPrice: 120 });
    expect(scenarios.customSale?.profit).toBe(8);
    expect(scenarios.customSale?.effectiveMarginRate).toBeCloseTo(0.0667, 3);
    expect(scenarios.customSale?.differenceFromBalance).toBeCloseTo(8.89, 2);
  });

  it("calculates discount and cost-change impacts", () => {
    const scenarios = calculatePricingScenarios({ ...baseScenario, discountRate: 0.1, costVariationRate: 0.2 });
    expect(scenarios.discount?.price).toBeCloseTo(128.57, 2);
    expect(scenarios.discount?.profit).toBeCloseTo(15.72, 2);
    expect(scenarios.costVariation?.newTotalCost).toBe(120);
    expect(scenarios.costVariation?.requiredPrice).toBeCloseTo(171.43, 2);
  });
});
