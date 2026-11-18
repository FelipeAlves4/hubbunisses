import { describe, expect, it } from "vitest";
import {
  companyDocumentData,
  pdfFileName,
  proposalIdentifier,
  whatsappUrl,
  type ProposalDocumentData,
} from "./proposal-document";

const proposal: ProposalDocumentData = {
  id: "test", number: 27, title: "Proposta de instalação — São Paulo",
  description: null, issued_at: "2026-11-17", valid_until: null,
  payment_terms: null, delivery_terms: null, notes: null, template: "executive",
  subtotal: 0, discount_total: 0, additional_total: 0, tax_rate: 0, tax_total: 0, grand_total: 0,
  client_snapshot: {}, company_snapshot: {}, proposal_items: [],
};

describe("proposal document helpers", () => {
  it("uses a stable proposal identifier and safe PDF filename", () => {
    expect(proposalIdentifier(27)).toBe("PR-0027");
    expect(pdfFileName(proposal)).toBe("PR-0027-proposta-de-instalacao-sao-paulo.pdf");
  });
  it("only creates WhatsApp links for a valid Brazilian customer phone", () => {
    expect(whatsappUrl({ ...proposal, client_snapshot: { phone: "(11) 99999-9999" } })).toContain("https://wa.me/5511999999999?");
    expect(whatsappUrl({ ...proposal, client_snapshot: { phone: "telefone indisponível" } })).toBeNull();
  });
  it("prefers immutable commercial identity snapshots and validates accent colors", () => {
    const company = companyDocumentData(
      {
        ...proposal,
        company_snapshot: {
          name: "Razão social histórica",
          trade_name: "Marca histórica",
          phone: "(11) 4000-1234",
          email: "comercial@example.test",
          address: "Rua de teste, 1",
          accent_color: "#0A6EBD",
        },
      },
      { name: "Organização atual", phone: null, logoUrl: null },
    );
    expect(company).toMatchObject({
      name: "Marca histórica",
      email: "comercial@example.test",
      address: "Rua de teste, 1",
      accentColor: "#0A6EBD",
    });
    expect(
      companyDocumentData(
        { ...proposal, company_snapshot: { accent_color: "url(javascript:bad)" } },
        { name: "Organização atual", phone: null, logoUrl: null },
      ).accentColor,
    ).toBeNull();
  });
});
