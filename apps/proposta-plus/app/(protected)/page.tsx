"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  PackagePlus,
  Plus,
  Settings,
  Users,
  X,
} from "lucide-react";
import { ProposalDocumentActions } from "../../components/proposal-document-actions";
import { CompanyIdentitySettings } from "../../components/company-identity-settings";
import {
  ProposalDocumentPreview,
  TemplatePicker,
} from "../../components/proposal-document-preview";
import type {
  OrganizationDocumentFallback,
  ProposalDocumentData,
  ProposalTemplate,
} from "../../lib/proposal-document";
import {
  calculateProposalTotals,
  formatCurrency,
  lineTotal,
} from "../../lib/proposal-math";
import { createClient } from "../../lib/supabase/browser";
import { isSupabaseConfigured, portalUrl } from "../../lib/supabase/config";
import { LocalAuthControls } from "../local-auth-controls";

type Section =
  | "overview"
  | "proposals"
  | "clients"
  | "catalog"
  | "editor"
  | "document"
  | "settings";
type PropostaPageProps = {
  /** A relative destination makes the embedded Portal experience a client transition. */
  hubHref?: string;
  operationsHref?: string;
};
type Client = {
  id: string;
  name: string;
  type: "individual" | "company";
  email: string | null;
  phone: string | null;
  contact_name: string | null;
};
type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  kind: "product" | "service";
  unit: string;
  default_price: number;
  active: boolean;
};
type Proposal = {
  id: string;
  number: number;
  title: string;
  status: ProposalStatus;
  grand_total: number;
  issued_at: string;
  template: ProposalTemplate;
  proposal_clients: { name: string } | null;
};
type ProposalStatus =
  | "draft"
  | "sent"
  | "approved"
  | "declined"
  | "expired"
  | "cancelled";
type DraftLine = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountAmount: number;
  catalogItemId?: string;
};
const statusLabel: Record<ProposalStatus, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  approved: "Aprovada",
  declined: "Recusada",
  expired: "Expirada",
  cancelled: "Cancelada",
};
const emptyLine = (): DraftLine => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unit: "Unidade",
  unitPrice: 0,
  discountAmount: 0,
});

function PropostaWorkspace({ hubHref = portalUrl, operationsHref }: PropostaPageProps) {
  const searchParams = useSearchParams();
  const requestedClientId = searchParams.get("client_id");
  const requestedOpportunityId = searchParams.get("opportunity_id");
  const requestedProposalId = searchParams.get("proposal_id");
  const [section, setSection] = useState<Section>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationRole, setOrganizationRole] = useState<"owner" | "member" | null>(null);
  const [organizationDefaultTemplate, setOrganizationDefaultTemplate] =
    useState<ProposalTemplate>("executive");
  const [organizationName, setOrganizationName] = useState("Sua organização");
  const [organizationDocument, setOrganizationDocument] =
    useState<OrganizationDocumentFallback>({
      name: "Sua organização",
      phone: null,
      logoUrl: null,
    });
  const [clients, setClients] = useState<Client[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [error, setError] = useState("");
  const [schemaError, setSchemaError] = useState("");
  const [notice, setNotice] = useState("");
  const [showClientForm, setShowClientForm] = useState(false);
  const [showCatalogForm, setShowCatalogForm] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(
    null,
  );
  const [clientName, setClientName] = useState("");
  const [clientType, setClientType] = useState<"individual" | "company">(
    "company",
  );
  const [clientEmail, setClientEmail] = useState("");
  const [catalogName, setCatalogName] = useState("");
  const [catalogKind, setCatalogKind] = useState<"product" | "service">(
    "service",
  );
  const [catalogUnit, setCatalogUnit] = useState("Unidade");
  const [catalogPrice, setCatalogPrice] = useState("0");
  const [proposalClientId, setProposalClientId] = useState("");
  const [proposalTitle, setProposalTitle] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [additionalTotal, setAdditionalTotal] = useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [proposalDescription, setProposalDescription] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [proposalNotes, setProposalNotes] = useState("");
  const [proposalTemplate, setProposalTemplate] =
    useState<ProposalTemplate>("executive");
  const [documentProposal, setDocumentProposal] =
    useState<ProposalDocumentData | null>(null);
  const [documentTemplate, setDocumentTemplate] =
    useState<ProposalTemplate>("executive");
  const [documentLoading, setDocumentLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setSchemaError("");
    try {
      const supabase = createClient();
      const { data: claims } = await supabase.auth.getClaims();
      const userId = claims?.claims?.sub;
      if (!userId) {
        window.location.assign("/login?next=/");
        return;
      }
      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations(name, phone, logo_url)")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (membershipError || !membership) {
        window.location.assign("/access-denied");
        return;
      }
      const org = membership.organizations as unknown as {
        name: string;
        phone: string | null;
        logo_url: string | null;
      } | null;
      setOrganizationId(membership.organization_id);
      setOrganizationRole(membership.role as "owner" | "member");
      setOrganizationName(org?.name ?? "Sua organização");
      setOrganizationDocument({
        name: org?.name ?? "Sua organização",
        phone: org?.phone ?? null,
        logoUrl: org?.logo_url ?? null,
      });
      const [clientResult, catalogResult, proposalResult, documentSettingsResult] = await Promise.all([
        supabase
          .from("proposal_clients")
          .select("id, name, type, email, phone, contact_name")
          .order("name"),
        supabase
          .from("proposal_catalog_items")
          .select("id, name, description, kind, unit, default_price, active")
          .order("name"),
        supabase
          .from("proposals")
          .select(
            "id, number, title, status, grand_total, issued_at, template, proposal_clients(name)",
          )
          .order("updated_at", { ascending: false })
          .limit(8),
        supabase
          .from("organization_proposal_document_settings")
          .select("default_template")
          .eq("organization_id", membership.organization_id)
          .maybeSingle(),
      ]);
      const requestError =
        clientResult.error ?? catalogResult.error ?? proposalResult.error;
      if (requestError) throw requestError;
      setClients((clientResult.data ?? []) as Client[]);
      setCatalog((catalogResult.data ?? []) as CatalogItem[]);
      setProposals((proposalResult.data ?? []) as unknown as Proposal[]);
      if (
        requestedProposalId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedProposalId)
      ) {
        const requestedProposal = ((proposalResult.data ?? []) as unknown as Proposal[]).find(
          (proposal) => proposal.id === requestedProposalId,
        );
        if (requestedProposal) void openDocument(requestedProposal);
      }
      if (
        requestedClientId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedClientId) &&
        (clientResult.data ?? []).some((client: Client) => client.id === requestedClientId)
      ) {
        setProposalClientId(requestedClientId);
        setSection("editor");
      }
      if (
        documentSettingsResult.data?.default_template === "executive" ||
        documentSettingsResult.data?.default_template === "minimal" ||
        documentSettingsResult.data?.default_template === "commercial"
      ) {
        setOrganizationDefaultTemplate(documentSettingsResult.data.default_template);
      }
    } catch (cause) {
      const message =
        cause &&
        typeof cause === "object" &&
        "message" in cause &&
        typeof cause.message === "string"
          ? cause.message
          : "Não foi possível carregar os dados do PROPOSTA+.";
      setSchemaError(message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [requestedClientId, requestedProposalId]);

  const totals = useMemo(() => {
    try {
      return calculateProposalTotals({
        items: lines.map(({ quantity, unitPrice, discountAmount }) => ({
          quantity,
          unitPrice,
          discountAmount,
        })),
        additionalTotal: Number(additionalTotal) || 0,
        taxRate: Number(taxRate) || 0,
      });
    } catch {
      return {
        subtotal: 0,
        discountTotal: 0,
        additionalTotal: 0,
        taxTotal: 0,
        grandTotal: 0,
      };
    }
  }, [lines, additionalTotal, taxRate]);
  const metrics = useMemo(
    () => ({
      total: proposals.length,
      draft: proposals.filter((item) => item.status === "draft").length,
      sent: proposals.filter((item) => item.status === "sent").length,
      approved: proposals.filter((item) => item.status === "approved").length,
      approvedValue: proposals
        .filter((item) => item.status === "approved")
        .reduce((sum, item) => sum + Number(item.grand_total), 0),
    }),
    [proposals],
  );

  async function saveClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !clientName.trim()) {
      setError("Informe o nome ou a razão social do cliente.");
      return;
    }
    if (clientEmail && !/^\S+@\S+\.\S+$/.test(clientEmail)) {
      setError("Informe um e-mail válido ou deixe o campo em branco.");
      return;
    }
    setSaving(true);
    setNotice("");
    const values = {
      name: clientName.trim(),
      type: clientType,
      email: clientEmail.trim() || null,
    };
    const { error: requestError } = editingClientId
      ? await createClient()
          .from("proposal_clients")
          .update(values)
          .eq("id", editingClientId)
      : await createClient()
          .from("proposal_clients")
          .insert({ organization_id: organizationId, ...values });
    setSaving(false);
    if (requestError) {
      setError(requestError.message);
      return;
    }
    setClientName("");
    setClientEmail("");
    setEditingClientId(null);
    setShowClientForm(false);
    setNotice(editingClientId ? "Cliente atualizado." : "Cliente cadastrado.");
    void load();
  }
  async function saveCatalog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !catalogName.trim()) return;
    const price = Number(catalogPrice.replace(",", "."));
    if (!Number.isFinite(price) || price < 0) {
      setError("Informe um preço padrão válido.");
      return;
    }
    setSaving(true);
    setNotice("");
    const values = {
      name: catalogName.trim(),
      kind: catalogKind,
      unit: catalogUnit.trim() || "Unidade",
      default_price: price,
    };
    const { error: requestError } = editingCatalogId
      ? await createClient()
          .from("proposal_catalog_items")
          .update(values)
          .eq("id", editingCatalogId)
      : await createClient()
          .from("proposal_catalog_items")
          .insert({ organization_id: organizationId, ...values });
    setSaving(false);
    if (requestError) {
      setError(requestError.message);
      return;
    }
    setCatalogName("");
    setCatalogPrice("0");
    setEditingCatalogId(null);
    setShowCatalogForm(false);
    setNotice(
      editingCatalogId ? "Item de catálogo atualizado." : "Item adicionado ao catálogo.",
    );
    void load();
  }
  function openClientForm(client?: Client) {
    setEditingClientId(client?.id ?? null);
    setClientName(client?.name ?? "");
    setClientType(client?.type ?? "company");
    setClientEmail(client?.email ?? "");
    setShowClientForm(true);
  }
  function closeClientForm() {
    setEditingClientId(null);
    setClientName("");
    setClientEmail("");
    setShowClientForm(false);
  }
  function openCatalogForm(item?: CatalogItem) {
    setEditingCatalogId(item?.id ?? null);
    setCatalogName(item?.name ?? "");
    setCatalogKind(item?.kind ?? "service");
    setCatalogUnit(item?.unit ?? "Unidade");
    setCatalogPrice(item ? String(item.default_price) : "0");
    setShowCatalogForm(true);
  }
  function closeCatalogForm() {
    setEditingCatalogId(null);
    setCatalogName("");
    setCatalogPrice("0");
    setShowCatalogForm(false);
  }
  function addCatalogItem(item: CatalogItem) {
    const catalogLine: DraftLine = {
      id: crypto.randomUUID(),
      description: item.name,
      quantity: 1,
      unit: item.unit,
      unitPrice: Number(item.default_price),
      discountAmount: 0,
      catalogItemId: item.id,
    };
    setLines((current) => {
      const onlyEmptyLine =
        current.length === 1 &&
        !current[0].description.trim() &&
        current[0].unitPrice === 0 &&
        current[0].discountAmount === 0;
      return onlyEmptyLine ? [catalogLine] : [...current, catalogLine];
    });
  }
  function updateLine(
    id: string,
    key: keyof DraftLine,
    value: string | number,
  ) {
    setLines((current) =>
      current.map((line) =>
        line.id === id ? { ...line, [key]: value } : line,
      ),
    );
  }
  async function openDocument(proposal: Proposal) {
    setDocumentLoading(true);
    setError("");
    const { data, error: requestError } = await createClient()
      .from("proposals")
      .select(
        "id, number, title, description, issued_at, valid_until, payment_terms, delivery_terms, notes, template, subtotal, discount_total, additional_total, tax_rate, tax_total, grand_total, client_snapshot, company_snapshot, proposal_items(id, description, quantity, unit, unit_price, discount_amount, total, sort_order)",
      )
      .eq("id", proposal.id)
      .single();
    setDocumentLoading(false);
    if (requestError || !data) {
      setError(requestError?.message ?? "Não foi possível carregar o documento da proposta.");
      return;
    }
    const document = data as unknown as ProposalDocumentData;
    document.proposal_items = [...(document.proposal_items ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    setDocumentProposal(document);
    setDocumentTemplate(document.template ?? "executive");
    setSection("document");
  }
  async function changeDocumentTemplate(template: ProposalTemplate) {
    if (!documentProposal || template === documentTemplate) return;
    setDocumentTemplate(template);
    const { error: requestError } = await createClient()
      .from("proposals")
      .update({ template })
      .eq("id", documentProposal.id);
    if (requestError) {
      setDocumentTemplate(documentProposal.template);
      setError(requestError.message);
      return;
    }
    setDocumentProposal((current) =>
      current ? { ...current, template } : current,
    );
    setNotice("Modelo do documento atualizado.");
    void load();
  }
  async function saveProposal() {
    if (
      !organizationId ||
      !proposalClientId ||
      !proposalTitle.trim() ||
      lines.some(
        (line) =>
          !line.description.trim() ||
          !Number.isFinite(line.quantity) ||
          !Number.isFinite(line.unitPrice) ||
          !Number.isFinite(line.discountAmount) ||
          line.quantity <= 0 ||
          line.unitPrice < 0 ||
          line.discountAmount < 0 ||
          line.discountAmount >
            Math.round((line.quantity * line.unitPrice + Number.EPSILON) * 100) /
              100,
      )
    ) {
      setError("Informe cliente, título e itens válidos antes de salvar.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .insert({
        organization_id: organizationId,
        client_id: proposalClientId,
        title: proposalTitle.trim(),
        description: proposalDescription.trim() || null,
        status: "draft",
        issued_at: new Date().toISOString().slice(0, 10),
        valid_until: validUntil || null,
        payment_terms: paymentTerms || null,
        delivery_terms: deliveryTerms || null,
        notes: proposalNotes || null,
        template: proposalTemplate,
        additional_total: totals.additionalTotal,
        tax_rate: Number(taxRate) || 0,
      })
      .select("id")
      .single();
    if (proposalError || !proposal) {
      setSaving(false);
      setError(proposalError?.message ?? "Não foi possível criar a proposta.");
      return;
    }
    const { error: itemError } = await supabase
      .from("proposal_items")
      .insert(
        lines.map((line, sortOrder) => ({
          proposal_id: proposal.id,
          organization_id: organizationId,
          catalog_item_id: line.catalogItemId ?? null,
          description: line.description.trim(),
          quantity: line.quantity,
          unit: line.unit.trim() || "Unidade",
          unit_price: line.unitPrice,
          discount_amount: line.discountAmount,
          total: lineTotal(line),
          sort_order: sortOrder,
        })),
      );
    setSaving(false);
    if (itemError) {
      setError(
        `A proposta foi criada, mas os itens não puderam ser gravados: ${itemError.message}`,
      );
      return;
    }
    if (
      requestedOpportunityId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedOpportunityId)
    ) {
      const { error: linkError } = await supabase
        .from("crm_opportunity_proposals")
        .insert({
          organization_id: organizationId,
          opportunity_id: requestedOpportunityId,
          proposal_id: proposal.id,
        });
      if (linkError) {
        setSaving(false);
        setError(`A proposta foi criada, mas não foi possível vinculá-la à oportunidade: ${linkError.message}`);
        return;
      }
    }
    setNotice("Proposta salva como rascunho.");
    setProposalClientId("");
    setProposalTitle("");
    setValidUntil("");
    setPaymentTerms("");
    setProposalDescription("");
    setDeliveryTerms("");
    setProposalNotes("");
    setProposalTemplate("executive");
    setLines([emptyLine()]);
    setSection("proposals");
    void load();
  }
  async function changeStatus(proposal: Proposal, status: ProposalStatus) {
    const { error: requestError } = await createClient()
      .from("proposals")
      .update({ status })
      .eq("id", proposal.id);
    if (requestError) {
      setError(requestError.message);
      return;
    }
    setNotice(`Proposta marcada como ${statusLabel[status].toLowerCase()}.`);
    void load();
  }
  function openNewProposal() {
    setProposalTemplate(organizationDefaultTemplate);
    setSection("editor");
  }

  const nav = [
    ["overview", "Visão geral", LayoutDashboard],
    ["proposals", "Propostas", FileText],
    ["clients", "Clientes", Users],
    ["catalog", "Catálogo", ClipboardList],
    ["settings", "Configurações", Settings],
  ] as const;
  return (
    <main className="proposta-shell">
      <aside className="proposta-rail">
        <div className="mobile-rail-bar">
          <a className="proposta-brand" href="#top">
            PROPOSTA<span>+</span>
          </a>
          <div className="mobile-rail-actions">
            <Link className="mobile-hub-link" href={hubHref} aria-label="Voltar ao ASEX Business Hub">
              <ArrowLeft size={19} />
            </Link>
            <button
              className="mobile-nav-toggle"
              type="button"
              aria-expanded={mobileMenuOpen}
              aria-controls="proposta-mobile-menu"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              <span>{mobileMenuOpen ? "Fechar" : "Menu"}</span>
            </button>
          </div>
        </div>
        <div className={`mobile-nav-panel${mobileMenuOpen ? " is-open" : ""}`} id="proposta-mobile-menu">
          <nav aria-label="Navegação principal">
            {nav.map(([id, label, Icon]) => (
              <button
                key={id}
                className={section === id ? "nav-current" : ""}
                onClick={() => {
                  setSection(id);
                  setMobileMenuOpen(false);
                }}
              >
                <Icon size={19} />
                {label}
              </button>
            ))}
          </nav>
          <div className="rail-secondary">
            <Link className="back-link" href={hubHref}>
              <ArrowLeft size={17} />
              Voltar ao Hub
            </Link>
            {isSupabaseConfigured() ? <LocalAuthControls /> : null}
          </div>
        </div>
      </aside>
      <section className="proposta-workspace" id="top">
        <header className="proposta-header">
          <div>
            <span>PROPOSTA+</span>
            <strong>{organizationName}</strong>
          </div>
          <button className="avatar" aria-label="Perfil indisponível" disabled>
            {organizationName.slice(0, 2).toUpperCase()}
          </button>
        </header>
        {error ? (
          <div className="inline-alert" role="alert">
            {error}
          </div>
        ) : null}
        {notice ? (
          <p className="toast" role="status">
            <Check size={17} />
            {notice}
          </p>
        ) : null}
        {!isSupabaseConfigured() ? (
          <section className="setup-panel">
            <FileText size={28} />
            <h1>Conecte o Supabase para iniciar</h1>
            <p>
              O PROPOSTA+ já possui interface, regras de cálculo e migration
              preparada. Configure as variáveis públicas para usar a organização
              e a persistência real.
            </p>
          </section>
        ) : loading ? (
          <section className="setup-panel">
            <LoaderCircle className="spin" size={28} />
            <p>Carregando os dados da organização…</p>
          </section>
        ) : schemaError ? (
          <section className="setup-panel">
            <FileText size={28} />
            <h1>Banco do PROPOSTA+ aguardando aprovação</h1>
            <p>
              A interface não exibirá dados fictícios. Aplique a migration local
              revisada para criar as tabelas da organização e liberar clientes,
              catálogo e propostas.
            </p>
            <small>{schemaError}</small>
          </section>
        ) : section === "overview" ? (
          <Overview
            metrics={metrics}
            proposals={proposals}
            onNew={openNewProposal}
            onOpen={() => setSection("proposals")}
          />
        ) : section === "clients" ? (
          <section className="page">
            <PageTitle
              title="Clientes"
              description="Cadastre contatos para reutilizar em suas propostas."
              action="Novo cliente"
              onAction={() => openClientForm()}
            />
            {showClientForm ? (
              <form className="entry-form" noValidate onSubmit={saveClient}>
                <label>
                  Nome ou razão social
                  <input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                    autoFocus
                  />
                </label>
                <label>
                  Tipo
                  <select
                    value={clientType}
                    onChange={(e) =>
                      setClientType(e.target.value as typeof clientType)
                    }
                  >
                    <option value="company">Pessoa jurídica</option>
                    <option value="individual">Pessoa física</option>
                  </select>
                </label>
                <label>
                  E-mail{" "}
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={closeClientForm}
                  >
                    Cancelar
                  </button>
                  <button className="primary" disabled={saving}>
                    {editingClientId ? "Salvar alterações" : "Salvar cliente"}
                  </button>
                </div>
              </form>
            ) : null}
            <DataTable
              empty="Nenhum cliente cadastrado."
              headers={["Cliente", "Tipo", "Contato", "Ações"]}
            >
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <strong>{client.name}</strong>
                  </td>
                  <td>
                    {client.type === "company"
                      ? "Pessoa jurídica"
                      : "Pessoa física"}
                  </td>
                  <td>{client.email ?? client.phone ?? "—"}</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => openClientForm(client)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </DataTable>
          </section>
        ) : section === "catalog" ? (
          <section className="page">
            <PageTitle
              title="Catálogo"
              description="Produtos e serviços reutilizáveis, sem alterar propostas já criadas."
              action="Novo item"
              onAction={() => openCatalogForm()}
            />
            {showCatalogForm ? (
              <form className="entry-form" noValidate onSubmit={saveCatalog}>
                <label>
                  Nome
                  <input
                    value={catalogName}
                    onChange={(e) => setCatalogName(e.target.value)}
                    required
                    autoFocus
                  />
                </label>
                <label>
                  Tipo
                  <select
                    value={catalogKind}
                    onChange={(e) =>
                      setCatalogKind(e.target.value as typeof catalogKind)
                    }
                  >
                    <option value="service">Serviço</option>
                    <option value="product">Produto</option>
                  </select>
                </label>
                <label>
                  Unidade
                  <input
                    value={catalogUnit}
                    onChange={(e) => setCatalogUnit(e.target.value)}
                  />
                </label>
                <label>
                  Preço padrão
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={catalogPrice}
                    onChange={(e) => setCatalogPrice(e.target.value)}
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={closeCatalogForm}
                  >
                    Cancelar
                  </button>
                  <button className="primary" disabled={saving}>
                    {editingCatalogId ? "Salvar alterações" : "Salvar item"}
                  </button>
                </div>
              </form>
            ) : null}
            <DataTable
              empty="Nenhum item cadastrado."
              headers={[
                "Item",
                "Tipo",
                "Unidade",
                "Preço padrão",
                "Uso",
                "Ações",
              ]}
            >
              {catalog.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                  </td>
                  <td>{item.kind === "service" ? "Serviço" : "Produto"}</td>
                  <td>{item.unit}</td>
                  <td>{formatCurrency(Number(item.default_price))}</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        addCatalogItem(item);
                        setSection("editor");
                      }}
                    >
                      Adicionar à proposta
                    </button>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => openCatalogForm(item)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </DataTable>
          </section>
        ) : section === "proposals" ? (
          <section className="page">
            <PageTitle
              title="Propostas"
              description="Acompanhe rascunhos, propostas enviadas e decisões comerciais."
              action="Nova proposta"
              onAction={openNewProposal}
            />
            <DataTable
              empty="Crie sua primeira proposta para começar."
              headers={[
                "Número",
                "Cliente",
                "Valor",
                "Status",
                "Emissão",
                "Ações",
              ]}
            >
              {proposals.map((proposal) => (
                <tr key={proposal.id}>
                  <td>PR-{String(proposal.number).padStart(4, "0")}</td>
                  <td>
                    <strong>
                      {proposal.proposal_clients?.name ?? "Cliente"}
                    </strong>
                  </td>
                  <td>{formatCurrency(Number(proposal.grand_total))}</td>
                  <td>
                    <span className={`status status-${proposal.status}`}>
                      {statusLabel[proposal.status]}
                    </span>
                  </td>
                  <td>
                    {new Intl.DateTimeFormat("pt-BR").format(
                      new Date(`${proposal.issued_at}T12:00:00`),
                    )}
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => void openDocument(proposal)}
                      disabled={documentLoading}
                    >
                      Documento
                    </button>
                    {operationsHref && proposal.status === "approved" && (
                      <Link className="text-button" href={operationsHref + "?proposta=" + proposal.id}>
                        Criar ordem de serviço
                      </Link>
                    )}
                    <select
                      aria-label={`Alterar status de ${proposal.title}`}
                      value={proposal.status}
                      onChange={(e) =>
                        void changeStatus(
                          proposal,
                          e.target.value as ProposalStatus,
                        )
                      }
                    >
                      {Object.entries(statusLabel).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </DataTable>
          </section>
        ) : section === "editor" ? (
          <Editor
            clients={clients}
            catalog={catalog}
            proposalClientId={proposalClientId}
            setProposalClientId={setProposalClientId}
            proposalTitle={proposalTitle}
            setProposalTitle={setProposalTitle}
            validUntil={validUntil}
            setValidUntil={setValidUntil}
            paymentTerms={paymentTerms}
            setPaymentTerms={setPaymentTerms}
            proposalDescription={proposalDescription}
            setProposalDescription={setProposalDescription}
            deliveryTerms={deliveryTerms}
            setDeliveryTerms={setDeliveryTerms}
            proposalNotes={proposalNotes}
            setProposalNotes={setProposalNotes}
            proposalTemplate={proposalTemplate}
            setProposalTemplate={setProposalTemplate}
            lines={lines}
            setLines={setLines}
            updateLine={updateLine}
            onAddCatalogItem={addCatalogItem}
            totals={totals}
            additionalTotal={additionalTotal}
            setAdditionalTotal={setAdditionalTotal}
            taxRate={taxRate}
            setTaxRate={setTaxRate}
            saving={saving}
            onSave={() => void saveProposal()}
          />
        ) : section === "document" && documentProposal ? (
          <DocumentWorkspace
            proposal={documentProposal}
            fallback={organizationDocument}
            template={documentTemplate}
            onTemplateChange={(template) => void changeDocumentTemplate(template)}
            onBack={() => setSection("proposals")}
            onNotice={setNotice}
            onError={setError}
          />
        ) : organizationId ? (
          <CompanyIdentitySettings
            organizationId={organizationId}
            fallback={organizationDocument}
            canManage={organizationRole === "owner"}
            onIdentitySaved={setOrganizationDocument}
            onDefaultTemplateSaved={setOrganizationDefaultTemplate}
            onNotice={setNotice}
            onError={setError}
          />
        ) : (
          <section className="setup-panel"><LoaderCircle className="spin" size={28} /><h1>Carregando configurações</h1></section>
        )}
      </section>
    </main>
  );
}

export default function PropostaPage(props: PropostaPageProps) {
  return (
    <Suspense fallback={<main className="proposta-shell"><section className="setup-panel"><LoaderCircle className="spin" size={28} /><p>Carregando PROPOSTA+…</p></section></main>}>
      <PropostaWorkspace {...props} />
    </Suspense>
  );
}

function Overview({
  metrics,
  proposals,
  onNew,
  onOpen,
}: {
  metrics: Record<string, number>;
  proposals: Proposal[];
  onNew: () => void;
  onOpen: () => void;
}) {
  return (
    <section className="page overview">
      <header className="page-hero">
        <div>
          <h1>Propostas que viram negócios.</h1>
          <p>Prepare, acompanhe e organize suas negociações em um só lugar.</p>
        </div>
        <button className="primary" onClick={onNew}>
          <FilePlus2 size={19} />
          Nova proposta
        </button>
      </header>
      <div className="metric-grid">
        <Metric label="Total de propostas" value={String(metrics.total)} />
        <Metric label="Em rascunho" value={String(metrics.draft)} />
        <Metric label="Enviadas" value={String(metrics.sent)} />
        <Metric label="Aprovadas" value={String(metrics.approved)} />
        <Metric
          label="Valor aprovado"
          value={formatCurrency(metrics.approvedValue)}
        />
      </div>
      <section className="table-panel">
        <div className="panel-heading">
          <div>
            <h2>Propostas recentes</h2>
            <p>O histórico usa os dados reais da organização.</p>
          </div>
          <button className="text-button" onClick={onOpen}>
            Ver todas <ChevronRight size={17} />
          </button>
        </div>
        <DataTable
          empty="Ainda não há propostas. Crie a primeira quando estiver pronto."
          headers={["Número", "Cliente", "Valor", "Status"]}
        >
          {proposals.slice(0, 5).map((proposal) => (
            <tr key={proposal.id}>
              <td>PR-{String(proposal.number).padStart(4, "0")}</td>
              <td>{proposal.proposal_clients?.name ?? "Cliente"}</td>
              <td>{formatCurrency(Number(proposal.grand_total))}</td>
              <td>
                <span className={`status status-${proposal.status}`}>
                  {statusLabel[proposal.status]}
                </span>
              </td>
            </tr>
          ))}
        </DataTable>
      </section>
    </section>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
function PageTitle({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <header className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <button className="primary" onClick={onAction}>
        <Plus size={18} />
        {action}
      </button>
    </header>
  );
}
function DataTable({
  headers,
  empty,
  children,
}: {
  headers: string[];
  empty: string;
  children: React.ReactNode;
}) {
  const hasItems = Array.isArray(children) && children.length > 0;
  const tableLabel = `${headers.join(", ")}. Deslize horizontalmente para ver todas as colunas.`;
  return (
    <section className="table-panel">
      <div className="table-scroll" tabIndex={0} role="region" aria-label={tableLabel}>
        <table>
          <thead>
            <tr>
              {headers.map((item) => (
                <th key={item}>{item}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hasItems ? (
              children
            ) : (
              <tr>
                <td colSpan={headers.length} className="empty-row">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function DocumentWorkspace({
  proposal,
  fallback,
  template,
  onTemplateChange,
  onBack,
  onNotice,
  onError,
}: {
  proposal: ProposalDocumentData;
  fallback: OrganizationDocumentFallback;
  template: ProposalTemplate;
  onTemplateChange: (value: ProposalTemplate) => void;
  onBack: () => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <section className="page document-workspace">
      <header className="page-title document-page-title">
        <div>
          <button className="text-button" type="button" onClick={onBack}>
            <ArrowLeft size={17} /> Voltar para propostas
          </button>
          <h1>Documento da proposta</h1>
          <p>Prévia baseada exclusivamente nos dados persistidos da proposta.</p>
        </div>
        <ProposalDocumentActions
          proposal={proposal}
          fallback={fallback}
          template={template}
          onNotice={onNotice}
          onError={onError}
        />
      </header>
      <div className="document-layout">
        <aside className="document-controls">
          <span className="paper-eyebrow">Apresentação</span>
          <h2>Escolha o modelo</h2>
          <p>A troca altera a prévia e o arquivo exportado, sem modificar os totais ou os dados históricos.</p>
          <TemplatePicker value={template} onChange={onTemplateChange} />
        </aside>
        <div className="document-preview-frame">
          <ProposalDocumentPreview proposal={proposal} fallback={fallback} template={template} />
        </div>
      </div>
    </section>
  );
}
function Editor(props: {
  clients: Client[];
  catalog: CatalogItem[];
  proposalClientId: string;
  setProposalClientId: (value: string) => void;
  proposalTitle: string;
  setProposalTitle: (value: string) => void;
  validUntil: string;
  setValidUntil: (value: string) => void;
  paymentTerms: string;
  setPaymentTerms: (value: string) => void;
  proposalDescription: string;
  setProposalDescription: (value: string) => void;
  deliveryTerms: string;
  setDeliveryTerms: (value: string) => void;
  proposalNotes: string;
  setProposalNotes: (value: string) => void;
  proposalTemplate: ProposalTemplate;
  setProposalTemplate: (value: ProposalTemplate) => void;
  lines: DraftLine[];
  setLines: React.Dispatch<React.SetStateAction<DraftLine[]>>;
  updateLine: (
    id: string,
    key: keyof DraftLine,
    value: string | number,
  ) => void;
  onAddCatalogItem: (item: CatalogItem) => void;
  totals: ReturnType<typeof calculateProposalTotals>;
  additionalTotal: string;
  setAdditionalTotal: (value: string) => void;
  taxRate: string;
  setTaxRate: (value: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  const {
    clients,
    catalog,
    proposalClientId,
    setProposalClientId,
    proposalTitle,
    setProposalTitle,
    validUntil,
    setValidUntil,
    paymentTerms,
    setPaymentTerms,
    proposalDescription,
    setProposalDescription,
    deliveryTerms,
    setDeliveryTerms,
    proposalNotes,
    setProposalNotes,
    proposalTemplate,
    setProposalTemplate,
    lines,
    setLines,
    updateLine,
    onAddCatalogItem,
    totals,
    additionalTotal,
    setAdditionalTotal,
    taxRate,
    setTaxRate,
    saving,
    onSave,
  } = props;
  return (
    <section className="page editor">
      <header className="page-title">
        <div>
          <h1>Nova proposta</h1>
          <p>
            Os valores são calculados com precisão de centavos antes de salvar.
          </p>
        </div>
      </header>
      <div className="editor-layout">
        <div className="editor-main">
          <section className="form-panel">
            <h2>Dados da proposta</h2>
            <div className="field-grid">
              <label>
                Cliente
                <select
                  value={proposalClientId}
                  onChange={(e) => setProposalClientId(e.target.value)}
                >
                  <option value="">Selecione um cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Título
                <input
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                  placeholder="Ex.: Proposta comercial"
                />
              </label>
              <label>
                Validade
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </label>
            </div>
            <label>
              Apresentação comercial
              <textarea
                className="resize-none"
                value={proposalDescription}
                onChange={(e) => setProposalDescription(e.target.value)}
                placeholder="Contextualize a proposta para o cliente."
              />
            </label>
            <label>
              Condições comerciais
              <textarea
                className="resize-none"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="Pagamento, prazo de entrega, garantia e observações."
              />
            </label>
            <label>
              Condições de entrega
              <textarea
                className="resize-none"
                value={deliveryTerms}
                onChange={(e) => setDeliveryTerms(e.target.value)}
                placeholder="Prazos, local e condições de entrega."
              />
            </label>
            <label>
              Observações
              <textarea
                className="resize-none"
                value={proposalNotes}
                onChange={(e) => setProposalNotes(e.target.value)}
                placeholder="Informações complementares desta proposta."
              />
            </label>
            <div className="editor-template-field">
              <span>Modelo do documento</span>
              <TemplatePicker value={proposalTemplate} onChange={setProposalTemplate} />
            </div>
          </section>
          <section className="form-panel">
            <div className="section-line">
              <h2>Itens</h2>
              <select
                aria-label="Adicionar item do catálogo"
                onChange={(e) => {
                  const item = catalog.find(
                    (record) => record.id === e.target.value,
                  );
                  if (item) {
                    onAddCatalogItem(item);
                    e.target.value = "";
                  }
                }}
              >
                <option value="">Adicionar do catálogo</option>
                {catalog
                  .filter((item) => item.active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="line-table">
              {lines.map((line, index) => (
                <div className="proposal-line" key={line.id}>
                  <input
                    aria-label={`Descrição do item ${index + 1}`}
                    value={line.description}
                    onChange={(e) =>
                      updateLine(line.id, "description", e.target.value)
                    }
                    placeholder="Descrição"
                  />
                  <input
                    aria-label={`Quantidade do item ${index + 1}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(line.id, "quantity", Number(e.target.value))
                    }
                  />
                  <input
                    aria-label={`Unidade do item ${index + 1}`}
                    value={line.unit}
                    onChange={(e) =>
                      updateLine(line.id, "unit", e.target.value)
                    }
                  />
                  <input
                    aria-label={`Valor do item ${index + 1}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) =>
                      updateLine(line.id, "unitPrice", Number(e.target.value))
                    }
                  />
                  <input
                    aria-label={`Desconto do item ${index + 1}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.discountAmount}
                    onChange={(e) =>
                      updateLine(
                        line.id,
                        "discountAmount",
                        Number(e.target.value),
                      )
                    }
                  />
                  <strong>{formatCurrency(displayLineTotal(line))}</strong>
                  <button
                    className="icon-button"
                    aria-label={`Remover item ${index + 1}`}
                    onClick={() =>
                      setLines((current) =>
                        current.length > 1
                          ? current.filter((item) => item.id !== line.id)
                          : current,
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              className="outline"
              onClick={() => setLines((current) => [...current, emptyLine()])}
            >
              <Plus size={17} />
              Adicionar item personalizado
            </button>
          </section>
        </div>
        <aside className="total-panel">
          <h2>Total da proposta</h2>
          <label>
            Acréscimos
            <input
              type="number"
              min="0"
              step="0.01"
              value={additionalTotal}
              onChange={(e) => setAdditionalTotal(e.target.value)}
            />
          </label>
          <label>
            Tributos (%)
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </label>
          <Totals rows={totals} />
          <button
            className="primary save-button"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Check size={18} />
            )}
            Salvar proposta
          </button>
          <button className="outline" disabled>
            Prévia e PDF na próxima etapa
          </button>
        </aside>
      </div>
    </section>
  );
}
function displayLineTotal(line: DraftLine) {
  try {
    return lineTotal(line);
  } catch {
    return 0;
  }
}
function Totals({
  rows,
}: {
  rows: ReturnType<typeof calculateProposalTotals>;
}) {
  return (
    <dl className="totals">
      <div>
        <dt>Subtotal</dt>
        <dd>{formatCurrency(rows.subtotal)}</dd>
      </div>
      <div>
        <dt>Descontos</dt>
        <dd>− {formatCurrency(rows.discountTotal)}</dd>
      </div>
      <div>
        <dt>Acréscimos</dt>
        <dd>{formatCurrency(rows.additionalTotal)}</dd>
      </div>
      <div>
        <dt>Tributos</dt>
        <dd>{formatCurrency(rows.taxTotal)}</dd>
      </div>
      <div className="grand">
        <dt>Total</dt>
        <dd>{formatCurrency(rows.grandTotal)}</dd>
      </div>
    </dl>
  );
}
