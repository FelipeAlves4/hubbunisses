import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import {
  calculatePricingScenarios,
  calculateProductPrice,
  calculateServicePrice,
} from "@asex/pricing";
import { buildPricingReportData, getRates } from "./report-data";
import {
  PricingReport,
  PRICING_REPORT_FOOTER_NOTICE,
} from "./pricing-report";

const pdfReportOutputDirectory = process.env.PDF_REPORT_OUTPUT_DIR;

const product = {
  name: "Café",
  acquisitionCost: 40,
  packagingCost: 2,
  freightPerUnit: 3,
  otherDirectCosts: 5,
  fixedExpensePerUnit: 10,
  commissionRate: 0.05,
  taxRate: 0.08,
  paymentFeeRate: 0.02,
  desiredMarginRate: 0.2,
};
const service = {
  name: "Instalação elétrica",
  estimatedHours: 8,
  hourlyCost: 50,
  professionalCount: 2,
  materialsCost: 80,
  travelCost: 30,
  outsourcingCost: 0,
  otherDirectCosts: 0,
  fixedExpenseAllocated: 20,
  commissionRate: 0.05,
  taxRate: 0.1,
  paymentFeeRate: 0.02,
  desiredMarginRate: 0.2,
};

describe("pricing report data", () => {
  it("keeps product figures and scenarios in the report payload", () => {
    const result = calculateProductPrice(product);
    const scenarios = calculatePricingScenarios({
      totalCost: result.totalCost,
      variableRate: result.variableRate,
      desiredMarginRate: product.desiredMarginRate,
      recommendedPrice: result.recommendedPrice,
      discountRate: 0.1,
    });
    const data = buildPricingReportData({
      referenceName: "Preço de varejo",
      kind: "product",
      input: product,
      result,
      scenarios,
      company: { legalName: "ASEX Comércio" },
    });
    expect(data.company.legalName).toBe("ASEX Comércio");
    expect(data.scenarios.discount?.price).toBeCloseTo(83.08, 2);
    expect(getRates(data.input)).toHaveLength(4);
  });

  it("supports a service report without a company logo", () => {
    const result = calculateServicePrice(service);
    const data = buildPricingReportData({
      referenceName: "Instalação padrão",
      kind: "service",
      input: service,
      result,
      scenarios: {},
      company: { legalName: "" },
    });
    expect(data.company.logoDataUrl).toBeUndefined();
    expect(data.result.totalCost).toBe(930);
    expect(data.result.recommendedPrice).toBeCloseTo(1476.19, 2);
  });

  it("renders a professional PDF for a valid product report", async () => {
    const result = calculateProductPrice(product);
    const data = buildPricingReportData({
      referenceName: "Café varejo",
      kind: "product",
      input: product,
      result,
      scenarios: {},
      company: { legalName: "ASEX Comércio" },
    });
    const document = await renderToBuffer(
      createElement(PricingReport, { data }) as never,
    );
    if (pdfReportOutputDirectory) {
      await mkdir(pdfReportOutputDirectory, { recursive: true });
      await writeFile(join(pdfReportOutputDirectory, "produto.pdf"), document);
    }
    expect(document.subarray(0, 4).toString()).toBe("%PDF");
    expect(document.byteLength).toBeGreaterThan(1_000);
  });

  it("renders a professional PDF for an electrical installation service", async () => {
    const result = calculateServicePrice(service);
    const data = buildPricingReportData({
      referenceName: "Instalação elétrica residencial",
      kind: "service",
      input: service,
      result,
      scenarios: {},
      company: { legalName: "ASEX Serviços" },
    });
    const document = await renderToBuffer(
      createElement(PricingReport, { data }) as never,
    );
    if (pdfReportOutputDirectory) {
      await mkdir(pdfReportOutputDirectory, { recursive: true });
      await writeFile(join(pdfReportOutputDirectory, "servico-instalacao-eletrica.pdf"), document);
    }
    expect(document.subarray(0, 4).toString()).toBe("%PDF");
    expect(document.byteLength).toBeGreaterThan(1_000);
  });

  it("uses the required discreet warning in the report footer", () => {
    expect(PRICING_REPORT_FOOTER_NOTICE).toBe(
      "Valores estimados com base nas informações fornecidas. Confira custos e tributos antes de definir o preço final.",
    );
  });
});
