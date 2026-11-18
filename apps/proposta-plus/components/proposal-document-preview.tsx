import type { CSSProperties } from "react";
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

const templateNames: Record<ProposalTemplate, string> = {
  executive: "Executivo",
  minimal: "Minimalista",
  commercial: "Comercial moderno",
};

export function TemplatePicker({
  value,
  onChange,
}: {
  value: ProposalTemplate;
  onChange: (value: ProposalTemplate) => void;
}) {
  return (
    <div className="template-picker" role="radiogroup" aria-label="Modelo do documento">
      {(Object.keys(templateNames) as ProposalTemplate[]).map((template) => (
        <button
          type="button"
          key={template}
          role="radio"
          aria-checked={value === template}
          className={`template-choice template-choice-${template}${
            value === template ? " is-selected" : ""
          }`}
          onClick={() => onChange(template)}
        >
          <span className="template-thumbnail" aria-hidden="true">
            <i />
            <b />
            <em />
          </span>
          <strong>{templateNames[template]}</strong>
          <small>
            {template === "executive"
              ? "Corporativo e estruturado"
              : template === "minimal"
                ? "Editorial e preciso"
                : "Direto e expressivo"}
          </small>
        </button>
      ))}
    </div>
  );
}

export function ProposalDocumentPreview({
  proposal,
  fallback,
  template = proposal.template,
}: {
  proposal: ProposalDocumentData;
  fallback: OrganizationDocumentFallback;
  template?: ProposalTemplate;
}) {
  const company = companyDocumentData(proposal, fallback);
  const clientName = documentText(proposal.client_snapshot, "name") ?? "Cliente";
  const clientContact = [
    documentText(proposal.client_snapshot, "contact_name"),
    documentText(proposal.client_snapshot, "email"),
    documentText(proposal.client_snapshot, "phone"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={`proposal-paper proposal-paper-${template}`}
      style={
        company.accentColor
          ? ({ "--document-accent": company.accentColor } as CSSProperties)
          : undefined
      }
    >
      <header className="paper-header">
        <div className="paper-company">
          {company.logoUrl ? (
            // External image is a persisted organization snapshot, not user-provided markup.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt={`Logotipo de ${company.name}`} />
          ) : (
            <span className="paper-monogram" aria-hidden="true">
              {company.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div>
            <strong>{company.name}</strong>
            <small>{[company.documentNumber, company.phone, company.email].filter(Boolean).join(" · ")}</small>
          </div>
        </div>
        <div className="paper-number">
          <span>PROPOSTA COMERCIAL</span>
          <strong>{proposalIdentifier(proposal.number)}</strong>
          <small>Emitida em {formatDocumentDate(proposal.issued_at)}</small>
        </div>
      </header>

      <section className="paper-intro">
        <div>
          <span className="paper-eyebrow">Para</span>
          <h2>{clientName}</h2>
          {clientContact ? <p>{clientContact}</p> : null}
        </div>
        <div className="paper-validity">
          <span>Validade</span>
          <strong>{formatDocumentDate(proposal.valid_until)}</strong>
        </div>
      </section>

      <section className="paper-title">
        <span className="paper-eyebrow">Proposta</span>
        <h1>{proposal.title}</h1>
        {proposal.description ? <p>{proposal.description}</p> : null}
      </section>

      <section className="paper-items" aria-label="Itens da proposta">
        <div className="paper-table-head">
          <span>Item</span><span>Qtd.</span><span>Unitário</span><span>Desconto</span><span>Total</span>
        </div>
        {proposal.proposal_items.map((item) => (
          <div className="paper-item" key={item.id}>
            <span><strong>{item.description}</strong><small>{item.unit}</small></span>
            <span>{Number(item.quantity).toLocaleString("pt-BR")}</span>
            <span>{formatDocumentCurrency(item.unit_price)}</span>
            <span>{item.discount_amount ? `− ${formatDocumentCurrency(item.discount_amount)}` : "—"}</span>
            <strong>{formatDocumentCurrency(item.total)}</strong>
          </div>
        ))}
      </section>

      <section className="paper-bottom">
        <div className="paper-terms">
          {company.address ? <DocumentBlock title="Endereço" value={company.address} /> : null}
          {proposal.payment_terms ? <DocumentBlock title="Condições de pagamento" value={proposal.payment_terms} /> : null}
          {proposal.delivery_terms ? <DocumentBlock title="Condições de entrega" value={proposal.delivery_terms} /> : null}
          {proposal.notes ? <DocumentBlock title="Observações" value={proposal.notes} /> : null}
        </div>
        <dl className="paper-totals">
          <div><dt>Subtotal</dt><dd>{formatDocumentCurrency(proposal.subtotal)}</dd></div>
          <div><dt>Descontos</dt><dd>− {formatDocumentCurrency(proposal.discount_total)}</dd></div>
          <div><dt>Acréscimos</dt><dd>{formatDocumentCurrency(proposal.additional_total)}</dd></div>
          <div><dt>Tributos ({Number(proposal.tax_rate).toLocaleString("pt-BR")}% )</dt><dd>{formatDocumentCurrency(proposal.tax_total)}</dd></div>
          <div className="paper-grand"><dt>Total da proposta</dt><dd>{formatDocumentCurrency(proposal.grand_total)}</dd></div>
        </dl>
      </section>
    </article>
  );
}

function DocumentBlock({ title, value }: { title: string; value: string }) {
  return <div className="paper-term"><h3>{title}</h3><p>{value}</p></div>;
}
