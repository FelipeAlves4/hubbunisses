import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  companyDocumentData,
  documentText,
  formatDocumentCurrency,
  formatDocumentDate,
  proposalIdentifier,
  type OrganizationDocumentFallback,
  type ProposalDocumentData,
  type ProposalTemplate,
} from "../lib/proposal-document";

const palette: Record<ProposalTemplate, { ink: string; accent: string; pale: string }> = {
  executive: { ink: "#10233f", accent: "#2563eb", pale: "#edf4ff" },
  minimal: { ink: "#202124", accent: "#576274", pale: "#f6f7f8" },
  commercial: { ink: "#1d1836", accent: "#a345ff", pale: "#f6efff" },
};

const styles = StyleSheet.create({
  page: { padding: 42, fontFamily: "Helvetica", fontSize: 9, color: "#172033", lineHeight: 1.35 },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, paddingBottom: 18, marginBottom: 22 },
  brand: { flexDirection: "row", alignItems: "center", width: "60%" },
  logo: { width: 34, height: 34, objectFit: "contain", marginRight: 10 },
  monogram: { width: 34, height: 34, borderRadius: 17, color: "#fff", textAlign: "center", paddingTop: 10, fontSize: 9, fontFamily: "Helvetica-Bold", marginRight: 10 },
  companyName: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  small: { color: "#64748b", marginTop: 3 },
  number: { textAlign: "right" },
  numberLabel: { fontSize: 7, letterSpacing: 1.1, color: "#64748b" },
  numberValue: { fontFamily: "Helvetica-Bold", fontSize: 16, marginVertical: 3 },
  intro: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  eyebrow: { fontSize: 7, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", marginBottom: 5 },
  client: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  validity: { textAlign: "right" },
  title: { fontFamily: "Helvetica-Bold", fontSize: 21, marginBottom: 8 },
  description: { color: "#475569", fontSize: 10, marginBottom: 22, maxWidth: 430 },
  table: { marginTop: 4 },
  tableHead: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  row: { flexDirection: "row", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  item: { width: "42%" },
  quantity: { width: "12%", textAlign: "right" },
  amount: { width: "15.3%", textAlign: "right" },
  itemName: { fontFamily: "Helvetica-Bold" },
  unit: { color: "#64748b", fontSize: 8, marginTop: 2 },
  lower: { flexDirection: "row", justifyContent: "space-between", marginTop: 26 },
  terms: { width: "53%", paddingRight: 20 },
  term: { marginBottom: 12 },
  termTitle: { fontFamily: "Helvetica-Bold", fontSize: 8, marginBottom: 3 },
  termValue: { color: "#475569", fontSize: 8.5 },
  totals: { width: "42%", padding: 14, borderRadius: 6 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  grand: { flexDirection: "row", justifyContent: "space-between", marginTop: 7, paddingTop: 9, borderTopWidth: 1, fontFamily: "Helvetica-Bold", fontSize: 13 },
  footer: { position: "absolute", bottom: 22, left: 42, right: 42, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8, flexDirection: "row", justifyContent: "space-between", color: "#64748b", fontSize: 7 },
});

export function ProposalPdf({
  proposal,
  fallback,
  template = proposal.template,
}: {
  proposal: ProposalDocumentData;
  fallback: OrganizationDocumentFallback;
  template?: ProposalTemplate;
}) {
  const company = companyDocumentData(proposal, fallback);
  const colors = palette[template];
  const clientName = documentText(proposal.client_snapshot, "name") ?? "Cliente";
  const clientContact = [
    documentText(proposal.client_snapshot, "contact_name"),
    documentText(proposal.client_snapshot, "email"),
    documentText(proposal.client_snapshot, "phone"),
  ].filter(Boolean).join(" · ");
  return (
    <Document title={`${proposalIdentifier(proposal.number)} - ${proposal.title}`} author={company.name} subject="Proposta comercial" language="pt-BR">
      <Page size="A4" style={styles.page} wrap>
        <View style={{ ...styles.header, borderBottomColor: colors.accent }} fixed>
          <View style={styles.brand}>
            {company.logoUrl ? <Image style={styles.logo} src={company.logoUrl} /> : <Text style={{ ...styles.monogram, backgroundColor: colors.ink }}>{company.name.slice(0, 2).toUpperCase()}</Text>}
            <View>
              <Text style={styles.companyName}>{company.name}</Text>
              <Text style={styles.small}>{[company.documentNumber, company.phone].filter(Boolean).join(" · ")}</Text>
            </View>
          </View>
          <View style={styles.number}>
            <Text style={styles.numberLabel}>PROPOSTA COMERCIAL</Text>
            <Text style={{ ...styles.numberValue, color: colors.ink }}>{proposalIdentifier(proposal.number)}</Text>
            <Text style={styles.small}>Emitida em {formatDocumentDate(proposal.issued_at)}</Text>
          </View>
        </View>

        <View style={styles.intro}>
          <View><Text style={styles.eyebrow}>Para</Text><Text style={styles.client}>{clientName}</Text>{clientContact ? <Text style={styles.small}>{clientContact}</Text> : null}</View>
          <View style={styles.validity}><Text style={styles.eyebrow}>Validade</Text><Text style={{ fontFamily: "Helvetica-Bold" }}>{formatDocumentDate(proposal.valid_until)}</Text></View>
        </View>
        <Text style={{ ...styles.title, color: colors.ink }}>{proposal.title}</Text>
        {proposal.description ? <Text style={styles.description}>{proposal.description}</Text> : null}

        <View style={styles.table}>
          <View style={{ ...styles.tableHead, borderBottomColor: colors.ink }} fixed><Text style={styles.item}>Item</Text><Text style={styles.quantity}>Qtd.</Text><Text style={styles.amount}>Unitário</Text><Text style={styles.amount}>Desconto</Text><Text style={styles.amount}>Total</Text></View>
          {proposal.proposal_items.map((item) => <View style={styles.row} key={item.id} wrap={false}>
            <View style={styles.item}><Text style={styles.itemName}>{item.description}</Text><Text style={styles.unit}>{item.unit}</Text></View>
            <Text style={styles.quantity}>{Number(item.quantity).toLocaleString("pt-BR")}</Text><Text style={styles.amount}>{formatDocumentCurrency(item.unit_price)}</Text><Text style={styles.amount}>{item.discount_amount ? `− ${formatDocumentCurrency(item.discount_amount)}` : "—"}</Text><Text style={{ ...styles.amount, fontFamily: "Helvetica-Bold" }}>{formatDocumentCurrency(item.total)}</Text>
          </View>)}
        </View>

        <View style={styles.lower} wrap={false}>
          <View style={styles.terms}>
            {proposal.payment_terms ? <PdfBlock title="Condições de pagamento" value={proposal.payment_terms} /> : null}
            {proposal.delivery_terms ? <PdfBlock title="Condições de entrega" value={proposal.delivery_terms} /> : null}
            {proposal.notes ? <PdfBlock title="Observações" value={proposal.notes} /> : null}
          </View>
          <View style={{ ...styles.totals, backgroundColor: colors.pale }}>
            <PdfTotal label="Subtotal" value={formatDocumentCurrency(proposal.subtotal)} />
            <PdfTotal label="Descontos" value={`− ${formatDocumentCurrency(proposal.discount_total)}`} />
            <PdfTotal label="Acréscimos" value={formatDocumentCurrency(proposal.additional_total)} />
            <PdfTotal label={`Tributos (${Number(proposal.tax_rate).toLocaleString("pt-BR")}%)`} value={formatDocumentCurrency(proposal.tax_total)} />
            <View style={{ ...styles.grand, borderTopColor: colors.accent }}><Text>Total da proposta</Text><Text>{formatDocumentCurrency(proposal.grand_total)}</Text></View>
          </View>
        </View>
        <View style={styles.footer} fixed><Text>{company.name}</Text><Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} /></View>
      </Page>
    </Document>
  );
}

function PdfBlock({ title, value }: { title: string; value: string }) {
  return <View style={styles.term}><Text style={styles.termTitle}>{title}</Text><Text style={styles.termValue}>{value}</Text></View>;
}
function PdfTotal({ label, value }: { label: string; value: string }) {
  return <View style={styles.totalRow}><Text>{label}</Text><Text>{value}</Text></View>;
}
