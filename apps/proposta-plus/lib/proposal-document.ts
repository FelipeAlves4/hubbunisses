export type ProposalTemplate = "executive" | "minimal" | "commercial";

export type ProposalDocumentLine = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_amount: number;
  total: number;
  sort_order: number;
};

export type ProposalDocumentData = {
  id: string;
  number: number;
  title: string;
  description: string | null;
  issued_at: string;
  valid_until: string | null;
  payment_terms: string | null;
  delivery_terms: string | null;
  notes: string | null;
  template: ProposalTemplate;
  subtotal: number;
  discount_total: number;
  additional_total: number;
  tax_rate: number;
  tax_total: number;
  grand_total: number;
  client_snapshot: Record<string, unknown>;
  company_snapshot: Record<string, unknown>;
  proposal_items: ProposalDocumentLine[];
};

export type OrganizationDocumentFallback = {
  name: string;
  phone: string | null;
  logoUrl: string | null;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

export const formatDocumentCurrency = (value: number | string | null) =>
  currency.format(Number(value ?? 0));

export const formatDocumentDate = (value: string | null) =>
  value ? date.format(new Date(`${value}T12:00:00Z`)) : "Não informado";

export const proposalIdentifier = (number: number) =>
  `PR-${String(number).padStart(4, "0")}`;

export const documentText = (source: Record<string, unknown>, key: string) => {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

export function companyDocumentData(
  proposal: ProposalDocumentData,
  fallback: OrganizationDocumentFallback,
) {
  return {
    name: documentText(proposal.company_snapshot, "name") ?? fallback.name,
    phone: documentText(proposal.company_snapshot, "phone") ?? fallback.phone,
    logoUrl:
      documentText(proposal.company_snapshot, "logo_url") ?? fallback.logoUrl,
    documentNumber: documentText(proposal.company_snapshot, "document_number"),
  };
}

export function whatsappUrl(proposal: ProposalDocumentData) {
  const phone = documentText(proposal.client_snapshot, "phone");
  const digits = phone?.replace(/\D/g, "") ?? "";
  const brazilianNumber =
    digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  if (brazilianNumber.length < 12 || brazilianNumber.length > 13) return null;
  const message = `Olá! Segue a proposta ${proposalIdentifier(proposal.number)} — ${proposal.title}.`;
  return `https://wa.me/${brazilianNumber}?text=${encodeURIComponent(message)}`;
}

export function pdfFileName(proposal: ProposalDocumentData) {
  const title = proposal.title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 64);
  return `${proposalIdentifier(proposal.number)}-${title || "proposta"}.pdf`;
}
