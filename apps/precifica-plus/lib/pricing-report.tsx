"use client";

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import type { PricingReportData } from "./report-data";
import { getRates, inputLabel } from "./report-data";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const percentage = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const date = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeStyle: "short",
});

export const PRICING_REPORT_FOOTER_NOTICE =
  "Valores estimados com base nas informações fornecidas. Confira custos e tributos antes de definir o preço final.";

const styles = StyleSheet.create({
  page: {
    paddingTop: 38,
    paddingHorizontal: 38,
    paddingBottom: 62,
    color: "#22232a",
    fontFamily: "Helvetica",
    fontSize: 9,
    lineHeight: 1.45,
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#9d1d2c",
    paddingBottom: 15,
    marginBottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  brand: {
    fontSize: 10,
    color: "#9d1d2c",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginTop: 5,
    marginBottom: 6,
  },
  muted: { color: "#666b75" },
  logo: { width: 44, height: 44, objectFit: "contain" },
  section: { marginTop: 15 },
  sectionTitle: {
    color: "#9d1d2c",
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 7,
  },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: {
    width: "31%",
    backgroundColor: "#f4f4f5",
    padding: 8,
    borderRadius: 3,
  },
  metricEmphasis: {
    width: "31%",
    backgroundColor: "#431820",
    color: "#fff",
    padding: 8,
    borderRadius: 3,
  },
  metricLabel: { fontSize: 7.5, color: "#656872" },
  metricLabelLight: { fontSize: 7.5, color: "#e5cdd0" },
  metricValue: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 3 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e7",
    paddingVertical: 5,
  },
  tableHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f0f0f2",
    padding: 6,
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    position: "absolute",
    left: 38,
    right: 38,
    bottom: 25,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e7",
    paddingTop: 7,
    color: "#737680",
    fontSize: 7,
  },
  footerContent: { width: 410 },
  footerBrand: { fontFamily: "Helvetica-Bold", marginBottom: 2 },
  footerPageNumber: { position: "absolute", right: 0, top: 7 },
});

function Metric({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View style={emphasis ? styles.metricEmphasis : styles.metric}>
      <Text style={emphasis ? styles.metricLabelLight : styles.metricLabel}>
        {label}
      </Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export function PricingReport({ data }: { data: PricingReportData }) {
  const { company, result, input, scenarios } = data;
  const accent = company.accentColor || "#9d1d2c";
  const contact = [company.phone, company.email].filter(Boolean).join(" · ");
  return (
    <Document
      title={`Relatório de Precificação - ${data.referenceName}`}
      author={company.legalName || "PRECIFICA+"}
      subject="Estimativa de precificação"
    >
      <Page size="A4" style={styles.page}>
        <View style={[styles.header, { borderBottomColor: accent }]}>
          <View>
            <Text style={[styles.brand, { color: accent }]}>
              {company.tradeName || company.legalName || "PRECIFICA+"}
            </Text>
            <Text style={styles.title}>Relatório de Precificação</Text>
            <Text style={styles.muted}>
              {date.format(new Date(data.generatedAt))}
              {contact ? ` · ${contact}` : ""}
            </Text>
          </View>
          {company.logoDataUrl ? (
            <Image style={styles.logo} src={company.logoDataUrl} />
          ) : null}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identificação</Text>
          <View style={styles.row}>
            <Text>Referência</Text>
            <Text>{data.referenceName}</Text>
          </View>
          <View style={styles.row}>
            <Text>Item calculado</Text>
            <Text>{input.name}</Text>
          </View>
          <View style={styles.row}>
            <Text>Tipo</Text>
            <Text>{inputLabel(data.kind)}</Text>
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo financeiro</Text>
          <View style={styles.summary}>
            <Metric
              label="Custo total"
              value={money.format(result.totalCost)}
            />
            <Metric
              label="Preço de equilíbrio"
              value={money.format(result.priceFloor)}
            />
            <Metric
              label="Margem desejada"
              value={percentage.format(input.desiredMarginRate)}
            />
            <Metric
              label="Lucro estimado"
              value={money.format(result.grossProfitPerUnit)}
            />
            <Metric label="Markup" value={`${result.markup.toFixed(2)}x`} />
            <Metric
              label="Preço sugerido"
              value={money.format(result.recommendedPrice)}
              emphasis
            />
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Composição de custos</Text>
          <View style={styles.tableHead}>
            <Text>Item</Text>
            <Text>Valor</Text>
          </View>
          {result.composition
            .filter((item) => item.amount > 0)
            .map((item) => (
              <View style={styles.row} key={item.label}>
                <Text>{item.label}</Text>
                <Text>{money.format(item.amount)}</Text>
              </View>
            ))}
          <View style={styles.row}>
            <Text>Custos totais</Text>
            <Text>{money.format(result.totalCost)}</Text>
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Taxas e premissas</Text>
          {getRates(input).map(([label, rate]) => (
            <View style={styles.row} key={label}>
              <Text>{label} (sobre a receita)</Text>
              <Text>{percentage.format(rate)}</Text>
            </View>
          ))}
        </View>
        {scenarios.customSale ||
        scenarios.discount ||
        scenarios.costVariation ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cenários simulados</Text>
            {scenarios.customSale ? (
              <View style={styles.row}>
                <Text>
                  Preço personalizado:{" "}
                  {money.format(scenarios.customSale.price)} · margem{" "}
                  {percentage.format(scenarios.customSale.effectiveMarginRate)}
                </Text>
                <Text>Lucro {money.format(scenarios.customSale.profit)}</Text>
              </View>
            ) : null}
            {scenarios.discount ? (
              <View style={styles.row}>
                <Text>
                  Desconto: {money.format(scenarios.discount.discountAmount)} ·
                  margem{" "}
                  {percentage.format(scenarios.discount.effectiveMarginRate)}
                </Text>
                <Text>Lucro {money.format(scenarios.discount.profit)}</Text>
              </View>
            ) : null}
            {scenarios.costVariation ? (
              <View style={styles.row}>
                <Text>
                  Variação de custo: novo custo{" "}
                  {money.format(scenarios.costVariation.newTotalCost)}
                </Text>
                <Text>
                  Preço-meta{" "}
                  {money.format(scenarios.costVariation.requiredPrice)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <View fixed style={styles.footer}>
          <View style={styles.footerContent}>
            <Text style={styles.footerBrand}>
              PRECIFICA+ · Relatório gerado localmente
            </Text>
            <Text>{PRICING_REPORT_FOOTER_NOTICE}</Text>
          </View>
          <Text
            style={styles.footerPageNumber}
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function downloadPricingReport(
  data: PricingReportData,
  fileName: string,
) {
  const blob = await pdf(<PricingReport data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
