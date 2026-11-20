import { randomUUID } from "node:crypto";
import Link from "next/link";
import Form from "next/form";
import {
  ArrowLeft, ArrowUpRight, CalendarDays, CircleCheck, ClipboardList,
  Columns3, Gauge, Hourglass, ListFilter, Plus, Timer, UserRound,
} from "lucide-react";
import { createClient } from "../../lib/supabase/server";
import { requireApplicationAccess, getOptionalApplicationAccess } from "../../lib/application-access";
import { OperationForm, OrderForm, StatusForm, TaskForm } from "./forms";
import { isUuid, isOpen, isLate, orderNumber, priorities, progress, statuses, type Option, type Order, type Proposal, type Task } from "./model";

const root = "/operacoes";
const timestamp = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = (value: string | null) => value ? value.split("-").reverse().join("/") : "—";
const name = (options: Option[], id: string | null) => options.find((option) => option.id === id)?.name ?? "—";
const detailHref = (id: string) => root + "?ordem=" + id;

const eventLabels: Record<string, string> = {
  order_created: "Ordem criada", status_changed: "Status alterado", assignee_changed: "Responsável alterado",
  deadline_changed: "Prazo alterado", notes_changed: "Observação atualizada", order_completed: "Ordem finalizada",
  task_completed: "Tarefa concluída", task_reopened: "Tarefa reaberta",
};
type Event = { id: string; event_type: string; actor_id: string | null; created_at: string; details: Record<string, string | null> };
type Filters = Record<string, string>;

function OrderCard({ order, clients, members, today, children }: {
  order: Order; clients: Option[]; members: Option[]; today: string; children?: React.ReactNode;
}) {
  return <article className="opera-card opera-order" data-status={order.status}>
    <span className="opera-code">{orderNumber(order.number)}</span>
    <h3><Link href={detailHref(order.id)}>{order.title}<ArrowUpRight size={15} aria-hidden="true" /></Link></h3>
    <p>{name(clients, order.client_id)}</p>
    <div className="opera-order-meta">
      <span><UserRound size={14} aria-hidden="true" />{name(members, order.responsible_user_id)}</span>
      <span><CalendarDays size={14} aria-hidden="true" />{date(order.due_date)}</span>
    </div>
    <div className="opera-tags">
      <span className="opera-status">{statuses[order.status]}</span><span>{priorities[order.priority]}</span>
      {isLate(order, today) && <span className="opera-late">Atrasada</span>}
    </div>
    {children}
  </article>;
}

function FilterBar({ filters, clients, members, view }: { filters: Filters; clients: Option[]; members: Option[]; view: string }) {
  return <Form className="opera-panel opera-filters" action={root}>
    <div className="opera-filter-title"><ListFilter size={17} aria-hidden="true" /><h2>Filtros</h2></div>
    <input type="hidden" name="visao" value={view} />
    <label>Criação a partir de<input type="date" name="de" defaultValue={filters.de} /></label>
    <label>Criação até<input type="date" name="ate" defaultValue={filters.ate} /></label>
    <label>Status<select name="status" defaultValue={filters.status}>
      <option value="">Todos</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    <label>Cliente<select name="cliente" defaultValue={filters.cliente}>
      <option value="">Todos</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    <label>Responsável<select name="responsavel" defaultValue={filters.responsavel}>
      <option value="">Todos</option>{members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    <label>Prioridade<select name="prioridade" defaultValue={filters.prioridade}>
      <option value="">Todas</option>{Object.entries(priorities).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    <div className="opera-inline"><button>Filtrar</button><Link href={root + "?visao=" + view}>Limpar</Link></div>
  </Form>;
}

function Dashboard({ orders, clients, members, today, soon, filters }: {
  orders: Order[]; clients: Option[]; members: Option[]; today: string; soon: string; filters: Filters;
}) {
  const counts = [
    ["Ordens abertas", orders.filter(isOpen).length, ClipboardList, "open"],
    ["Em andamento", orders.filter((o) => o.status === "in_progress").length, Timer, "in_progress"],
    ["Concluídas", orders.filter((o) => o.status === "completed").length, CircleCheck, "completed"],
    ["Atrasadas", orders.filter((o) => isLate(o, today)).length, Hourglass, "late"],
  ] as const;
  const byOwner = new Map<string | null, number>();
  for (const order of orders) byOwner.set(order.responsible_user_id, (byOwner.get(order.responsible_user_id) ?? 0) + 1);
  const upcoming = orders.filter((o) => isOpen(o) && o.due_date && o.due_date >= today && o.due_date <= soon)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  return <>
    <div className="opera-metrics">
      {counts.map(([label, count, Icon, status]) => (
        <div className="opera-card opera-metric" data-status={status} key={label}>
          <Icon className="opera-metric-icon" size={19} aria-hidden="true" />
          <strong>{count}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
    <FilterBar view="painel" {...{ filters, clients, members }} />
    <div className="opera-grid">
      <section className="opera-panel"><h2>Distribuição por status</h2>
        <ul className="opera-summary">{Object.entries(statuses).map(([key, label]) => {
          const total = orders.filter((o) => o.status === key).length;
          return <li key={key} data-status={key}><span>{label}</span><meter value={total} max={orders.length || 1} aria-label={label} /><b>{total}</b></li>;
        })}</ul>
      </section>
      <section className="opera-panel"><h2>Ordens por responsável</h2>
        {byOwner.size ? <ul className="opera-summary">{[...byOwner].map(([id, count]) =>
          <li key={id ?? "none"}><span>{id ? name(members, id) : "Sem responsável"}</span><meter value={count} max={orders.length} aria-label={id ? name(members, id) : "Sem responsável"} /><b>{count}</b></li>
        )}</ul> : <p>Nenhuma ordem no período.</p>}
      </section>
    </div>
    <section className="opera-panel"><h2>Vencimentos nos próximos 7 dias</h2>
      {upcoming.length ? <div className="opera-cards">{upcoming.map((order) => <OrderCard key={order.id} {...{ order, clients, members, today }} />)}</div> : <p>Nenhuma ordem aberta com prazo nessa janela.</p>}
    </section>
  </>;
}

function EventDetails({ event, members }: { event: Event; members: Option[] }) {
  const { from, to, notes, description } = event.details;
  if (event.event_type === "status_changed") return <p>{statuses[from as keyof typeof statuses]} → {statuses[to as keyof typeof statuses]}</p>;
  if (event.event_type === "deadline_changed") return <p>{date(from ?? null)} → {date(to ?? null)}</p>;
  if (event.event_type === "assignee_changed") return <p>{name(members, from ?? null)} → {name(members, to ?? null)}</p>;
  if (event.event_type === "notes_changed") return <p className="opera-text">{notes ?? "Observação removida"}</p>;
  return description ? <p>{description}</p> : null;
}

function OrderDetail({ order, tasks, events, clients, members, proposals, canManage }: {
  order: Order; tasks: Task[]; events: Event[]; clients: Option[]; members: Option[]; proposals: Proposal[]; canManage: boolean;
}) {
  const completion = progress(tasks);
  return <>
    <section className="opera-panel">
      <div className="opera-code">{orderNumber(order.number)}</div>
      <h2>{order.title}</h2>
      {order.description && <p className="opera-text">{order.description}</p>}
      <dl className="opera-details">
        <div><dt>Cliente</dt><dd>{name(clients, order.client_id)}</dd></div>
        <div><dt>Responsável</dt><dd>{name(members, order.responsible_user_id)}</dd></div>
        <div><dt>Status</dt><dd>{statuses[order.status]}</dd></div>
        <div><dt>Prioridade</dt><dd>{priorities[order.priority]}</dd></div>
        <div><dt>Criada em</dt><dd>{timestamp.format(new Date(order.created_at))}</dd></div>
        <div><dt>Início previsto</dt><dd>{date(order.start_date)}</dd></div>
        <div><dt>Prazo previsto</dt><dd>{date(order.due_date)}</dd></div>
        <div><dt>Conclusão real</dt><dd>{order.completed_at ? timestamp.format(new Date(order.completed_at)) : "—"}</dd></div>
        <div><dt>Valor previsto</dt><dd>{order.estimated_value === null ? "—" : money.format(Number(order.estimated_value))}</dd></div>
        {order.proposal_id && <div><dt>Proposta vinculada</dt><dd><Link href={"/proposta?proposal_id=" + order.proposal_id}>Consultar proposta</Link></dd></div>}
      </dl>
      {order.notes && <><h3>Observações</h3><p className="opera-text">{order.notes}</p></>}
      {canManage && <details><summary>Editar ordem</summary><OrderForm key={order.id} id={order.id} {...{ order, clients, members, proposals }} /></details>}
    </section>
    <div className="opera-grid">
      <section className="opera-panel">
        <h2>Checklist</h2>
        <label>Progresso · {completion}%<progress value={completion} max={100} /></label>
        {tasks.length ? <ul className="opera-entries">{tasks.map((task) => <li key={task.id}>
          <h3>{task.description}</h3><p>{task.done ? "Concluída" : "Pendente"} · {name(members, task.responsible_user_id)} · Prazo {date(task.due_date)}</p>
          {task.completed_at && <small>Concluída em {timestamp.format(new Date(task.completed_at))}</small>}
          {canManage && <div className="opera-task-actions">
            <OperationForm id={task.id} orderId={order.id} operation="task-toggle" label={task.done ? "Reabrir" : "Concluir"}>
              <input type="hidden" name="done" value={String(!task.done)} />
            </OperationForm>
            <details><summary>Editar tarefa</summary>
              <TaskForm id={task.id} orderId={order.id} {...{ task, members }} />
              <OperationForm id={task.id} orderId={order.id} operation="task-delete" label="Remover tarefa" />
            </details>
          </div>}
        </li>)}</ul> : <p>Nenhuma tarefa cadastrada.</p>}
        {canManage && <details><summary>Nova tarefa</summary><TaskForm id={randomUUID()} orderId={order.id} members={members} /></details>}
      </section>
      <section className="opera-panel"><h2>Histórico</h2>
        {events.length ? <ol className="opera-entries">{events.map((event) => <li key={event.id}>
          <h3>{eventLabels[event.event_type] ?? event.event_type}</h3>
          <small>{timestamp.format(new Date(event.created_at))} · {event.actor_id ? name(members, event.actor_id) : "Sistema"}</small>
          <EventDetails {...{ event, members }} />
        </li>)}</ol> : <p>Nenhum evento registrado.</p>}
      </section>
    </div>
  </>;
}

async function collect<T>(read: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  const size = 500;
  for (let start = 0; ; start += size) {
    const { data, error } = await read(start, start + size - 1);
    if (error || !data) throw new Error("Não foi possível carregar os dados operacionais.");
    rows.push(...data);
    if (data.length < size) return rows;
  }
}

function dateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
const localDay = (value: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(value);

export default async function OperaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requireApplicationAccess("opera-plus", "/operacoes");
  if (!access) return <main className="opera-shell"><Link href="/">Voltar ao Hub</Link><h1>OPERA+</h1><p>Configure o Supabase para acessar as operações.</p></main>;
  const { organizationId, userId, role } = access;
  const params = await searchParams;
  const param = (key: string) => typeof params[key] === "string" ? params[key] : "";
  const view = ["ordens", "kanban", "nova"].includes(param("visao")) ? param("visao") : "painel";
  const orderId = param("ordem");
  const proposalId = param("proposta");
  const filters = Object.fromEntries(["de", "ate", "status", "cliente", "responsavel", "prioridade"].map((key) => [key, param(key)]));
  const canManage = (order: Order) => order.created_by === userId || role === "owner" || role === "admin";
  const db = await createClient();
  const today = localDay(new Date());
  const soon = localDay(new Date(Date.now() + 7 * 86_400_000));

  async function content() {
    const [clients, team] = await Promise.all([
      collect<Option>((start, end) => db.from("proposal_clients").select("id, name").eq("organization_id", organizationId).order("name").order("id").range(start, end)),
      db.rpc("opera_team", { target_org: organizationId }),
    ]);
    if (team.error) throw new Error("Falha ao carregar a equipe.");
    const members: Option[] = ((team.data ?? []) as { id: string; name: string | null }[]).map((member) => ({
      ...member, name: member.name ?? "Membro " + member.id.slice(0, 8),
    }));
    const propostaAccess = orderId || view === "nova" || proposalId
      ? await getOptionalApplicationAccess("proposta-plus")
      : null;
    const canLinkProposal = propostaAccess?.organizationId === organizationId;
    const loadProposals = () => canLinkProposal ? collect<Proposal>((start, end) => db.from("proposals")
      .select("id, number, title, client_id, amount:grand_total::text").eq("organization_id", organizationId)
      .eq("status", "approved").order("number", { ascending: false }).order("id").range(start, end)) : Promise.resolve([]);

    if (orderId) {
      if (!isUuid(orderId)) return <p>Ordem não encontrada.</p>;
      const { data, error } = await db.from("service_orders").select("*").eq("organization_id", organizationId).eq("id", orderId).maybeSingle();
      if (error) throw error;
      if (!data) return <p>Ordem não encontrada nesta organização.</p>;
      const order = data as Order;
      const [tasks, events, proposals] = await Promise.all([
        collect<Task>((start, end) => db.from("service_order_tasks").select("*").eq("organization_id", organizationId).eq("order_id", orderId).order("created_at").order("id").range(start, end)),
        collect<Event>((start, end) => db.from("service_order_events").select("*").eq("organization_id", organizationId).eq("order_id", orderId).order("created_at", { ascending: false }).order("id").range(start, end)),
        canManage(order) ? loadProposals() : [],
      ]);
      return <OrderDetail {...{ order, tasks, events, clients, members, proposals }} canManage={canManage(order)} />;
    }

    if (view === "nova" || proposalId) {
      const proposals = await loadProposals();
      const proposal = proposals.find((item) => item.id === proposalId);
      if (proposalId && !proposal) return <section className="opera-panel"><p>Selecione uma proposta aprovada da sua organização.</p><Link href={root + "?visao=nova"}>Criar ordem independente</Link></section>;
      if (proposal) {
        const { data, error } = await db.from("service_orders").select("id, number").eq("organization_id", organizationId).eq("proposal_id", proposal.id).maybeSingle();
        if (error) throw error;
        if (data) return <section className="opera-panel"><h2>Proposta já convertida</h2><Link href={detailHref(data.id)}>Consultar {orderNumber(data.number)}</Link></section>;
      }
      return <section className="opera-panel opera-editor"><h2>Nova ordem de serviço</h2>
        {clients.length ? <OrderForm key={proposalId || "new"} id={randomUUID()} {...{ proposal, clients, members, proposals }} /> :
          <p>Cadastre um cliente no <Link href="/proposta">PROPOSTA+</Link> para criar sua primeira ordem.</p>}
      </section>;
    }

    const orderQuery = () => {
      let query = db.from("service_orders").select("*").eq("organization_id", organizationId);
      if (Object.hasOwn(statuses, filters.status)) query = query.eq("status", filters.status);
      if (Object.hasOwn(priorities, filters.prioridade)) query = query.eq("priority", filters.prioridade);
      if (isUuid(filters.cliente)) query = query.eq("client_id", filters.cliente);
      if (isUuid(filters.responsavel)) query = query.eq("responsible_user_id", filters.responsavel);
      if (dateOnly(filters.de)) query = query.gte("created_at", filters.de + "T00:00:00-03:00");
      if (dateOnly(filters.ate)) query = query.lte("created_at", filters.ate + "T23:59:59.999999-03:00");
      return query;
    };
    const orders = await collect<Order>((start, end) => orderQuery().order("created_at", { ascending: false }).order("id").range(start, end));
    const shared = { clients, members, today };
    if (view === "painel") return <Dashboard {...{ orders, soon, filters, ...shared }} />;
    return <>
      <FilterBar {...{ filters, clients, members, view }} />
      {view === "kanban" ? <div className="opera-board">{Object.entries(statuses).map(([key, label]) => {
          const column = orders.filter((order) => order.status === key);
          return <section className="opera-column" data-status={key} key={key}><h2>{label} <span>{column.length}</span></h2>
            {column.length ? column.map((order) => <OrderCard key={order.id} order={order} {...shared}>
              {canManage(order) && <StatusForm key={order.status} order={order} />}
            </OrderCard>) : <p>Nenhuma ordem nesta etapa.</p>}
          </section>;
        })}</div>
        : orders.length ? <div className="opera-cards">{orders.map((order) => <OrderCard key={order.id} order={order} {...shared} />)}</div>
          : <section className="opera-panel"><h2>Nenhuma ordem encontrada</h2><p>Ajuste os filtros ou cadastre uma ordem de serviço.</p></section>}
    </>;
  }

  let workspace;
  try {
    workspace = await content();
  } catch {
    workspace = <section className="opera-panel" role="alert"><h2>Os dados operacionais estão indisponíveis</h2><p>Verifique a configuração do OPERA+ e tente novamente.</p></section>;
  }

  const views = [
    ["painel", "Dashboard", Gauge],
    ["ordens", "Ordens de serviço", ClipboardList],
    ["kanban", "Kanban", Columns3],
  ] as const;

  return <main className="opera-shell">
    <header className="opera-header">
      <Link href="/" className="opera-back"><ArrowLeft size={16} aria-hidden="true" /> ASEX Business Hub</Link>
      <div className="opera-hero">
        <div>
          <h1>OPERA<span>+</span></h1>
          <p>Ordens de serviço, tarefas e entregas</p>
        </div>
        <Link className="opera-primary" href={root + "?visao=nova"}><Plus size={18} aria-hidden="true" /> Nova ordem</Link>
      </div>
    </header>
    <nav className="opera-nav" aria-label="Navegação operacional">
      {views.map(([key, label, Icon]) =>
        <Link key={key} href={root + "?visao=" + key} aria-current={!orderId && !proposalId && view === key ? "page" : undefined}>
          <Icon size={17} aria-hidden="true" />{label}
        </Link>)}
    </nav>
    {workspace}
  </main>;
}
