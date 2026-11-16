import type {
  PricingResult,
  PricingScenarios,
  ProductPricingInput,
  ServicePricingInput,
} from "@asex/pricing";
import type { CompanyProfile } from "./company-profile";
import type {
  SavedScenario,
  SimulationKind,
  SimulationInput,
} from "./simulation-repository";

export type PricingReportData = {
  generatedAt: string;
  referenceName: string;
  kind: SimulationKind;
  input: SimulationInput;
  result: PricingResult;
  scenarios: PricingScenarios;
  scenarioValues?: SavedScenario;
  company: CompanyProfile;
};

export function buildPricingReportData(
  input: Omit<PricingReportData, "generatedAt">,
): PricingReportData {
  return { ...input, generatedAt: new Date().toISOString() };
}

export function getRates(input: SimulationInput) {
  return [
    ["Tributos", input.taxRate],
    ["Comissões", input.commissionRate],
    ["Taxas de pagamento", input.paymentFeeRate],
    ["Margem desejada", input.desiredMarginRate],
  ] as const;
}

export function inputLabel(kind: SimulationKind) {
  return kind === "product" ? "Produto" : "Serviço";
}
export function isProductInput(
  input: SimulationInput,
): input is ProductPricingInput {
  return "acquisitionCost" in input;
}
export function isServiceInput(
  input: SimulationInput,
): input is ServicePricingInput {
  return "estimatedHours" in input;
}
