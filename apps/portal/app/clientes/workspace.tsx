"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  CalendarCheck2,
  ChevronRight,
  CircleDollarSign,
  ContactRound,
  FilePlus2,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  PhoneCall,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  addActivityAction,
  completeFollowUpAction,
  saveClientAction,
  saveOpportunityAction,
} from "./actions";
import { formatDocumentNumber, normalizeDocumentNumber } from "./client-input";
import { orderNumber } from "../operacoes/model";
import { getCRMIndicators } from "./crm";

export type Client = {
  id: string;
  name: string;
  type: "individual" | "company";
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  document_number: string | null;
  address: string | null;
  notes: string | null;
  created_by: string;
};
export type Opportunity = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  estimated_value_cents: number;
  stage: Stage;
  priority: Priority;
  expected_close_date: string | null;
  next_contact_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  proposal_clients: { name: string } | null;
};
export type Activity = {
  id: string;
  opportunity_id: string;
  activity_type: ActivityType | "stage_changed";
  body: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
};
export type ProposalLink = {
  opportunity_id: string;
  serviceOrder?: { id: string; number: number };
  proposals: {
    id: string;
    number: number;
    title: string;
    grand_total: number;
    status: string;
  } | null;
};
type Stage =
  | "new_lead"
  | "contact_started"
  | "qualification"
  | "proposal_sent"
  | "negotiation"
  | "won"
  | "lost";
type Priority = "low" | "medium" | "high";
type ActivityType =
  | "call"
  | "whatsapp"
  | "email"
  | "meeting"
  | "note"
  | "follow_up";
type View = "overview" | "clients" | "pipeline" | "activities" | "detail";

const stageLabels: Record<Stage, string> = {
  new_lead: "Novo lead",
  contact_started: "Contato iniciado",
  qualification: "Qualificação",
  proposal_sent: "Proposta enviada",
  negotiation: "Negociação",
  won: "Ganho",
  lost: "Perdido",
};
const stages = Object.keys(stageLabels) as Stage[];
const activityLabels: Record<ActivityType | "stage_changed", string> = {
  call: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  meeting: "Reunião",
  note: "Observação",
  follow_up: "Acompanhamento",
  stage_changed: "Etapa atualizada",
};
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
        new Date(`${value.slice(0, 10)}T12:00:00`),
      )
    : "—";
const toCents = (value: string) =>
  Math.round(Number(value.replace(/\./g, "").replace(",", ".")) * 100);

export function CRMWorkspace({
  clients,
  opportunities,
  activities,
  proposalLinks,
}: {
  clients: Client[];
  opportunities: Opportunity[];
  activities: Activity[];
  proposalLinks: ProposalLink[];
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState(false);
  const [opportunityForm, setOpportunityForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const selected = opportunities.find((item) => item.id === selectedId) ?? null;
  const followUps = activities.filter(
    (item) => item.activity_type === "follow_up" && !item.completed_at,
  );
  const today = new Date().toISOString().slice(0, 10);
  const metrics = useMemo(() => {
    const indicators = getCRMIndicators(
      opportunities.map((item) => ({
        stage: item.stage,
        estimated_value_cents: Number(item.estimated_value_cents),
      })),
      followUps,
      today,
    );
    return {
      open: opportunities.filter(
        (item) => item.stage !== "won" && item.stage !== "lost",
      ),
      value: indicators.estimatedPipelineCents,
      won: indicators.won,
      lost: indicators.lost,
      overdue: indicators.overdueFollowUps,
    };
  }, [opportunities, followUps, today]);
  const result = (action: Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => {
      setError("");
      const response = await action;
      if (response.ok) {
        setNotice(response.message);
        setClientForm(false);
        setOpportunityForm(false);
        router.refresh();
      } else setError(response.message);
    });
  const go = (next: View) => {
    setView(next);
    setMenuOpen(false);
  };
  const openDetail = (id: string) => {
    setSelectedId(id);
    go("detail");
  };
  return (
    <main className="clienta-shell">
      <aside className="clienta-rail">
        <div className="clienta-brand">
          <strong>ASEX</strong>
          <span>CLIENTA+</span>
        </div>
        <nav aria-label="Navegação CLIENTA+">
          {[
            ["overview", "Visão geral", LayoutDashboard],
            ["clients", "Clientes", Users],
            ["pipeline", "Funil", CircleDollarSign],
            ["activities", "Atividades", CalendarCheck2],
          ].map(([id, label, Icon]) => (
            <button
              key={id as string}
              className={view === id ? "active" : ""}
              onClick={() => go(id as View)}
            >
              <Icon size={18} />
              {label as string}
            </button>
          ))}
        </nav>
        <Link href="/" className="hub-back">
          ← Voltar ao Hub
        </Link>
      </aside>
      <div className="clienta-mobile">
        <strong>CLIENTA+</strong>
        <button
          type="button"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
        {menuOpen ? (
          <nav>
            {[
              ["overview", "Visão geral"],
              ["clients", "Clientes"],
              ["pipeline", "Funil"],
              ["activities", "Atividades"],
            ].map(([id, label]) => (
              <button key={id} onClick={() => go(id as View)}>
                {label}
              </button>
            ))}
          </nav>
        ) : null}
      </div>
      <section className="clienta-workspace">
        <header className="clienta-header">
          <div>
            <span>CRM comercial</span>
            <h1>
              {view === "overview"
                ? "Visão geral"
                : view === "clients"
                  ? "Clientes"
                  : view === "pipeline"
                    ? "Funil de vendas"
                    : view === "activities"
                      ? "Atividades e follow-ups"
                      : selected?.title}
            </h1>
          </div>
          <button
            className="primary-action"
            onClick={() => {
              setOpportunityForm(true);
              setView("pipeline");
            }}
          >
            <Plus size={18} />
            Nova oportunidade
          </button>
        </header>
        {notice ? (
          <p className="clienta-notice" role="status">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="clienta-alert" role="alert">
            {error}
          </p>
        ) : null}
        {view === "overview" ? (
          <Overview
            metrics={metrics}
            opportunities={opportunities}
            activities={activities}
            onOpen={openDetail}
          />
        ) : null}
        {view === "clients" ? (
          <Clients
            clients={clients}
            query={query}
            setQuery={setQuery}
            onAdd={() => setClientForm(true)}
            onOpportunity={(id) => {
              setOpportunityForm(true);
              setSelectedId(id);
            }}
          />
        ) : null}
        {view === "pipeline" ? (
          <Pipeline
            opportunities={opportunities}
            onOpen={openDetail}
            onMove={(opportunity, stage) =>
              result(
                saveOpportunityAction({
                  id: opportunity.id,
                  clientId: opportunity.client_id,
                  title: opportunity.title,
                  description: opportunity.description ?? "",
                  estimatedValueCents: Number(
                    opportunity.estimated_value_cents,
                  ),
                  stage,
                  priority: opportunity.priority,
                  expectedCloseDate: opportunity.expected_close_date,
                  nextContactDate: opportunity.next_contact_date,
                }),
              )
            }
          />
        ) : null}
        {view === "activities" ? (
          <Activities
            activities={followUps}
            opportunities={opportunities}
            pending={pending}
            onComplete={(id) => result(completeFollowUpAction(id))}
            onOpen={openDetail}
          />
        ) : null}
        {view === "detail" && selected ? (
          <Detail
            opportunity={selected}
            activities={activities.filter(
              (item) => item.opportunity_id === selected.id,
            )}
            links={proposalLinks.filter(
              (item) => item.opportunity_id === selected.id,
            )}
            pending={pending}
            onBack={() => go("pipeline")}
            onActivity={(input) =>
              result(
                addActivityAction({ opportunityId: selected.id, ...input }),
              )
            }
            onMove={(stage) =>
              result(
                saveOpportunityAction({
                  id: selected.id,
                  clientId: selected.client_id,
                  title: selected.title,
                  description: selected.description ?? "",
                  estimatedValueCents: Number(selected.estimated_value_cents),
                  stage,
                  priority: selected.priority,
                  expectedCloseDate: selected.expected_close_date,
                  nextContactDate: selected.next_contact_date,
                }),
              )
            }
          />
        ) : null}
        {clientForm ? (
          <ClientForm
            pending={pending}
            onClose={() => setClientForm(false)}
            onSave={(input) => result(saveClientAction(input))}
          />
        ) : null}
        {opportunityForm ? (
          <OpportunityForm
            clients={clients}
            initialClientId={view === "clients" ? (selectedId ?? "") : ""}
            pending={pending}
            onClose={() => setOpportunityForm(false)}
            onSave={(input) => result(saveOpportunityAction(input))}
          />
        ) : null}
      </section>
    </main>
  );
}

function Overview({
  metrics,
  opportunities,
  activities,
  onOpen,
}: {
  metrics: {
    open: Opportunity[];
    value: number;
    won: number;
    lost: number;
    overdue: number;
  };
  opportunities: Opportunity[];
  activities: Activity[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="clienta-page">
      <section className="metric-grid">
        <Metric
          label="Total de clientes"
          value={String(
            new Set(opportunities.map((item) => item.client_id)).size,
          )}
        />
        <Metric
          label="Oportunidades abertas"
          value={String(metrics.open.length)}
        />
        <Metric
          label="Valor estimado no funil"
          value={money.format(metrics.value / 100)}
        />
        <Metric
          label="Follow-ups vencidos"
          value={String(metrics.overdue)}
          tone={metrics.overdue ? "warning" : ""}
        />
      </section>
      <section className="clienta-panel">
        <div className="panel-title">
          <div>
            <h2>Negociações por etapa</h2>
            <p>Valor estimado; não representa receita recebida.</p>
          </div>
        </div>
        <div className="stage-summary">
          {stages.map((stage) => {
            const items = opportunities.filter((item) => item.stage === stage);
            return (
              <div key={stage}>
                <span>{stageLabels[stage]}</span>
                <strong>{items.length}</strong>
                <small>
                  {money.format(
                    items.reduce(
                      (sum, item) => sum + Number(item.estimated_value_cents),
                      0,
                    ) / 100,
                  )}
                </small>
              </div>
            );
          })}
        </div>
      </section>
      <section className="clienta-panel">
        <div className="panel-title">
          <div>
            <h2>Oportunidades recentes</h2>
            <p>Atualizadas por sua equipe.</p>
          </div>
        </div>
        <OpportunityTable
          opportunities={opportunities.slice(0, 6)}
          onOpen={onOpen}
        />
      </section>
      <p className="crm-disclosure">
        Ganhas: {metrics.won} · Perdidas: {metrics.lost} · Atividades
        registradas: {activities.length}
      </p>
    </div>
  );
}
function Metric({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <article className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
function Clients({
  clients,
  query,
  setQuery,
  onAdd,
  onOpportunity,
}: {
  clients: Client[];
  query: string;
  setQuery: (value: string) => void;
  onAdd: () => void;
  onOpportunity: (id: string) => void;
}) {
  const filtered = clients.filter((client) =>
    `${client.name} ${client.email ?? ""} ${client.phone ?? ""}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR")),
  );
  return (
    <div className="clienta-page">
      <div className="list-toolbar">
        <label className="search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar nome, e-mail ou telefone"
            aria-label="Buscar clientes"
          />
          {query ? (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setQuery("")}
            >
              ×
            </button>
          ) : null}
        </label>
        <button className="primary-action" onClick={onAdd}>
          <Plus size={18} />
          Novo cliente
        </button>
      </div>
      <section className="clienta-panel table-panel">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contato</th>
              <th>Telefone</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((client) => (
                <tr key={client.id}>
                  <td>
                    <strong>{client.name}</strong>
                    <small>
                      {client.type === "company"
                        ? "Pessoa jurídica"
                        : "Pessoa física"}
                    </small>
                  </td>
                  <td>{client.contact_name ?? client.email ?? "—"}</td>
                  <td>{client.phone ?? "—"}</td>
                  <td>
                    <button
                      className="link-button"
                      onClick={() => onOpportunity(client.id)}
                    >
                      Criar oportunidade <ChevronRight size={15} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="empty">
                  Nenhum cliente encontrado. Cadastre o primeiro para ele também
                  aparecer no PROPOSTA+.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
function Pipeline({
  opportunities,
  onOpen,
  onMove,
}: {
  opportunities: Opportunity[];
  onOpen: (id: string) => void;
  onMove: (opportunity: Opportunity, stage: Stage) => void;
}) {
  return (
    <div className="clienta-page">
      <p className="mobile-kanban-help">
        Use o seletor de etapa em cada cartão no celular.
      </p>
      <div className="kanban">
        {stages.map((stage) => (
          <section key={stage} className={`kanban-column stage-${stage}`}>
            <header>
              <span>{stageLabels[stage]}</span>
              <strong>
                {opportunities.filter((item) => item.stage === stage).length}
              </strong>
            </header>
            {opportunities
              .filter((item) => item.stage === stage)
              .map((item) => (
                <article className="deal-card" key={item.id}>
                  <button onClick={() => onOpen(item.id)}>
                    <strong>{item.title}</strong>
                    <span>{item.proposal_clients?.name ?? "Cliente"}</span>
                    <b>
                      {money.format(Number(item.estimated_value_cents) / 100)}
                    </b>
                  </button>
                  <label>
                    Etapa
                    <select
                      value={item.stage}
                      onChange={(event) =>
                        onMove(item, event.target.value as Stage)
                      }
                    >
                      {stages.map((option) => (
                        <option value={option} key={option}>
                          {stageLabels[option]}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
              ))}
            {!opportunities.some((item) => item.stage === stage) ? (
              <p className="column-empty">Sem oportunidades</p>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
function Activities({
  activities,
  opportunities,
  pending,
  onComplete,
  onOpen,
}: {
  activities: Activity[];
  opportunities: Opportunity[];
  pending: boolean;
  onComplete: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="clienta-page">
      <section className="clienta-panel">
        <div className="panel-title">
          <div>
            <h2>Próximos acompanhamentos</h2>
            <p>Itens pendentes e prazos comerciais.</p>
          </div>
        </div>
        <div className="followup-list">
          {activities.length ? (
            activities.map((activity) => {
              const opportunity = opportunities.find(
                (item) => item.id === activity.opportunity_id,
              );
              const overdue =
                activity.due_date &&
                activity.due_date < new Date().toISOString().slice(0, 10);
              return (
                <article key={activity.id}>
                  <div>
                    <strong>{opportunity?.title ?? "Oportunidade"}</strong>
                    <p>{activity.body || "Acompanhamento sem descrição"}</p>
                    <small className={overdue ? "overdue" : ""}>
                      Prazo: {date(activity.due_date)}
                    </small>
                  </div>
                  <div>
                    <button
                      className="link-button"
                      onClick={() => onOpen(activity.opportunity_id)}
                    >
                      Ver
                    </button>
                    <button
                      className="complete-button"
                      disabled={pending}
                      onClick={() => onComplete(activity.id)}
                    >
                      Concluir
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="empty">Não há acompanhamentos pendentes.</p>
          )}
        </div>
      </section>
    </div>
  );
}
function Detail({
  opportunity,
  activities,
  links,
  pending,
  onBack,
  onActivity,
  onMove,
}: {
  opportunity: Opportunity;
  activities: Activity[];
  links: ProposalLink[];
  pending: boolean;
  onBack: () => void;
  onActivity: (input: {
    activityType: ActivityType;
    body?: string;
    dueDate?: string | null;
  }) => void;
  onMove: (stage: Stage) => void;
}) {
  const [type, setType] = useState<ActivityType>("note");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState("");
  return (
    <div className="clienta-page detail">
      <button className="back-button" onClick={onBack}>
        ← Voltar ao funil
      </button>
      <section className="detail-header">
        <div>
          <span className={`stage-tag stage-${opportunity.stage}`}>
            {stageLabels[opportunity.stage]}
          </span>
          <h2>{opportunity.title}</h2>
          <p>{opportunity.proposal_clients?.name}</p>
        </div>
        <div>
          <strong>
            {money.format(Number(opportunity.estimated_value_cents) / 100)}
          </strong>
          <label>
            Etapa
            <select
              value={opportunity.stage}
              onChange={(event) => onMove(event.target.value as Stage)}
            >
              {stages.map((item) => (
                <option key={item} value={item}>
                  {stageLabels[item]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <div className="detail-grid">
        <section className="clienta-panel">
          <h3>Histórico comercial</h3>
          <div className="timeline">
            {activities.length ? (
              activities.map((activity) => (
                <article key={activity.id}>
                  <span>
                    <MessageSquareText size={16} />
                  </span>
                  <div>
                    <strong>{activityLabels[activity.activity_type]}</strong>
                    <p>{activity.body || "Sem observação."}</p>
                    <small>
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(activity.created_at))}
                    </small>
                  </div>
                </article>
              ))
            ) : (
              <p className="empty">
                Ainda não há atividades nesta oportunidade.
              </p>
            )}
          </div>
        </section>
        <aside>
          <section className="clienta-panel">
            <h3>Registrar atividade</h3>
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                onActivity({
                  activityType: type,
                  body,
                  dueDate: dueDate || null,
                });
                setBody("");
                setDueDate("");
              }}
            >
              <label>
                Tipo
                <select
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as ActivityType)
                  }
                >
                  {(
                    [
                      "call",
                      "whatsapp",
                      "email",
                      "meeting",
                      "note",
                      "follow_up",
                    ] as ActivityType[]
                  ).map((item) => (
                    <option key={item} value={item}>
                      {activityLabels[item]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Descrição
                <textarea
                  className="resize-none"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
              </label>
              {type === "follow_up" ? (
                <label>
                  Prazo
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </label>
              ) : null}
              <button className="primary-action" disabled={pending}>
                <PhoneCall size={17} />
                {pending ? "Salvando…" : "Registrar"}
              </button>
            </form>
          </section>
          <section className="clienta-panel proposal-links">
            <div className="panel-title">
              <div>
                <h3>Propostas vinculadas</h3>
                <p>Documentos permanecem no PROPOSTA+.</p>
              </div>
            </div>
            {links.length ? (
              links.map((link) =>
                link.proposals ? (
                  <div className="linked-proposal" key={link.proposals.id}>
                    <Link href={`/proposta?proposal_id=${link.proposals.id}`}>
                      PR-{String(link.proposals.number).padStart(4, "0")} ·{" "}
                      {link.proposals.title}
                      <ChevronRight size={16} />
                    </Link>
                    {link.serviceOrder && (
                      <Link href={`/operacoes?ordem=${link.serviceOrder.id}`}>
                        Consultar {orderNumber(link.serviceOrder.number)}
                        <ChevronRight size={16} />
                      </Link>
                    )}
                  </div>
                ) : null,
              )
            ) : (
              <p className="empty">Nenhuma proposta vinculada.</p>
            )}
            <a
              className="create-proposal"
              href={`/proposta?client_id=${opportunity.client_id}&opportunity_id=${opportunity.id}`}
            >
              <FilePlus2 size={17} />
              Criar proposta
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}
function OpportunityTable({
  opportunities,
  onOpen,
}: {
  opportunities: Opportunity[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Oportunidade</th>
            <th>Valor estimado</th>
            <th>Etapa</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.length ? (
            opportunities.map((item) => (
              <tr key={item.id}>
                <td>{item.proposal_clients?.name ?? "Cliente"}</td>
                <td>
                  <button
                    className="table-link"
                    onClick={() => onOpen(item.id)}
                  >
                    {item.title}
                  </button>
                </td>
                <td>
                  {money.format(Number(item.estimated_value_cents) / 100)}
                </td>
                <td>
                  <span className={`stage-tag stage-${item.stage}`}>
                    {stageLabels[item.stage]}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="empty">
                Crie a primeira oportunidade para visualizar o funil.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function ClientForm({
  pending,
  onClose,
  onSave,
}: {
  pending: boolean;
  onClose: () => void;
  onSave: (input: Parameters<typeof saveClientAction>[0]) => void;
}) {
  const [type, setType] = useState<"individual" | "company">("company");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentError, setDocumentError] = useState("");
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-form-title"
      >
        <header>
          <div>
            <span>Cadastro compartilhado</span>
            <h2 id="client-form-title">Novo cliente</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            try {
              normalizeDocumentNumber(documentNumber, type);
              setDocumentError("");
            } catch (error) {
              setDocumentError(error instanceof Error ? error.message : "Documento inválido.");
              return;
            }
            onSave({
              name: String(form.get("name") || ""),
              type,
              contactName: String(form.get("contactName") || ""),
              email: String(form.get("email") || ""),
              phone: String(form.get("phone") || ""),
              documentNumber,
              address: String(form.get("address") || ""),
              notes: String(form.get("notes") || ""),
            });
          }}
        >
          <label>
            Nome ou razão social
            <input required name="name" autoFocus />
          </label>
          <label>
            Tipo
            <select
              value={type}
              onChange={(event) => {
                setType(event.target.value as typeof type);
                setDocumentNumber("");
                setDocumentError("");
              }}
            >
              <option value="company">Pessoa jurídica</option>
              <option value="individual">Pessoa física</option>
            </select>
          </label>
          <label>
            Nome do contato
            <input name="contactName" />
          </label>
          <label>
            E-mail
            <input name="email" type="email" />
          </label>
          <label>
            Telefone / WhatsApp
            <input name="phone" inputMode="tel" />
          </label>
          <label>
            {type === "individual" ? "CPF (opcional)" : "CNPJ (opcional)"}
            <input
              aria-invalid={Boolean(documentError)}
              aria-describedby={documentError ? "client-document-error" : undefined}
              inputMode="numeric"
              name="documentNumber"
              onChange={(event) => {
                setDocumentNumber(formatDocumentNumber(event.target.value, type));
                setDocumentError("");
              }}
              placeholder={type === "individual" ? "000.000.000-00" : "00.000.000/0000-00"}
              value={documentNumber}
            />
            {documentError ? <small className="clienta-error" id="client-document-error">{documentError}</small> : null}
          </label>
          <label className="full">
            Endereço
            <textarea className="resize-none" name="address" />
          </label>
          <label className="full">
            Observações
            <textarea className="resize-none" name="notes" />
          </label>
          <footer>
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary-action" disabled={pending}>
              {pending ? "Salvando…" : "Salvar cliente"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
function OpportunityForm({
  clients,
  initialClientId,
  pending,
  onClose,
  onSave,
}: {
  clients: Client[];
  initialClientId: string;
  pending: boolean;
  onClose: () => void;
  onSave: (input: Parameters<typeof saveOpportunityAction>[0]) => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="opportunity-form-title"
      >
        <header>
          <div>
            <span>Funil de vendas</span>
            <h2 id="opportunity-form-title">Nova oportunidade</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            onSave({
              clientId: String(form.get("clientId") || ""),
              title: String(form.get("title") || ""),
              description: String(form.get("description") || ""),
              estimatedValueCents: toCents(String(form.get("value") || "0")),
              stage: "new_lead",
              priority: form.get("priority") as Priority,
              expectedCloseDate:
                String(form.get("expectedCloseDate") || "") || null,
              nextContactDate:
                String(form.get("nextContactDate") || "") || null,
            });
          }}
        >
          <label className="full">
            Cliente
            <select required name="clientId" defaultValue={initialClientId}>
              {!initialClientId ? (
                <option value="">Selecione um cliente</option>
              ) : null}
              {clients.map((client) => (
                <option value={client.id} key={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="full">
            Título
            <input required name="title" autoFocus />
          </label>
          <label>
            Valor estimado
            <input
              required
              name="value"
              inputMode="decimal"
              placeholder="0,00"
            />
          </label>
          <label>
            Prioridade
            <select name="priority" defaultValue="medium">
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </select>
          </label>
          <label>
            Previsão de fechamento
            <input name="expectedCloseDate" type="date" />
          </label>
          <label>
            Próximo contato
            <input name="nextContactDate" type="date" />
          </label>
          <label className="full">
            Descrição
            <textarea className="resize-none" name="description" />
          </label>
          <footer>
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary-action" disabled={pending}>
              {pending ? "Salvando…" : "Criar oportunidade"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
