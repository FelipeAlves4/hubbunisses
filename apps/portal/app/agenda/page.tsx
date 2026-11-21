import Link from "next/link";
import Form from "next/form";
import { ArrowLeft, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { requireApplicationAccess } from "../../lib/application-access";
import { createClient } from "../../lib/supabase/server";
import { addDays, calendarPeriod, displayDay, isDay, labels, localDay, localTime, transitions, uuid,
  type Appointment, type Assignment, type Client, type Professional, type Service, type Settings, type Status, type View } from "../../lib/agenda/model";
import { AgendaForm, ClientSelect, InternalBooking } from "./forms";
import { AvailabilityPanel, ProfessionalsPanel, ServicesPanel, SettingsPanel } from "./configuration";

export const dynamic = "force-dynamic";

const tabs = {
  visao: "Visão geral", calendario: "Calendário", agendamentos: "Agendamentos",
  servicos: "Serviços", profissionais: "Profissionais", disponibilidade: "Disponibilidade", configuracoes: "Configurações",
} as const;
const viewLabels = { dia: "Dia", semana: "Semana", mes: "Mês" } as const;
const actionLabels: Record<Status, string> = {
  pending: "Marcar pendente", confirmed: "Confirmar", in_service: "Iniciar atendimento",
  completed: "Concluir", cancelled: "Cancelar", no_show: "Registrar ausência",
};
const events: Record<string, string> = { created: "Reserva criada", rescheduled: "Reagendamento", client_link_changed: "Vínculo de cliente alterado", ...labels };
const link = (query: Record<string, string>) => "/agenda?" + new URLSearchParams(query).toString();

type Result<T> = { data: T | null; error: { message: string } | null };
function data<T>(result: Result<T>) {
  if (result.error) throw new Error("Não foi possível carregar a agenda.");
  return result.data;
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requireApplicationAccess("agenda-plus", "/agenda");
  if (!access) return <main className="agenda-shell"><h1>Agenda+</h1><p>Configure o Supabase para acessar a agenda.</p><Link href="/">Voltar ao Hub</Link></main>;
  const db = await createClient();
  const org = access.organizationId;
  const user = access.userId;
  const manage = access.role === "owner" || access.role === "admin";
  const params = await searchParams;
  const param = (key: string) => { const value = params[key]; return typeof value === "string" ? value : ""; };
  const tab = Object.hasOwn(tabs, param("secao")) ? param("secao") as keyof typeof tabs : "visao";
  const view = Object.hasOwn(viewLabels, param("periodo")) ? param("periodo") as View : "semana";

  async function workspace() {
    const settings = data(await db.from("agenda_settings").select("*").eq("organization_id", org).maybeSingle()) as Settings | null;
    const timezone = settings?.timezone ?? "America/Sao_Paulo";
    const today = localDay(new Date(), timezone);
    const requestedDay = param("data");
    const selected = isDay(requestedDay) && requestedDay >= "1900-01-01" && requestedDay <= "2200-12-31" ? requestedDay : today;
    const period = calendarPeriod(selected, view);
    const filters: Record<string, string> = { secao: tab, data: selected, periodo: view };
    const dateLink = (day: string) => link({ ...filters, data: day });
    const detailLink = (id: string) => link({ ...filters, id });
    const clientId = uuid(param("cliente")) ? param("cliente") : "";
    if (clientId) filters.cliente = clientId;
    const [serviceRows, personRows, assignmentsRows] = await Promise.all([
      db.from("agenda_services").select("id,name,description,duration_minutes,price_cents,active").eq("organization_id", org).order("name"),
      db.from("agenda_professionals").select("id,name,description,member_id,active").eq("organization_id", org).order("name"),
      db.from("agenda_professional_services").select("professional_id,service_id").eq("organization_id", org),
    ]);
    const services = (data(serviceRows) ?? []) as Service[];
    const professionals = (data(personRows) ?? []) as Professional[];
    const assignments = (data(assignmentsRows) ?? []) as Assignment[];
    if (tab === "configuracoes") return <SettingsPanel {...{ settings, manage }} />;
    if (tab === "servicos") return <ServicesPanel {...{ services, manage }} />;
    if (tab === "profissionais") {
      const members = manage ? data(await db.from("organization_members").select("user_id").eq("organization_id", org)) ?? [] : [];
      return <ProfessionalsPanel {...{ professionals, services, assignments, manage }} members={members.map((member) => member.user_id)} />;
    }
    if (tab === "disponibilidade") {
      const [shifts, blocks] = await Promise.all([
        db.from("agenda_working_hours").select("id,professional_id,weekday,local_date,start_time,end_time").eq("organization_id", org).order("weekday").order("start_time"),
        db.from("agenda_time_off").select("id,professional_id,starts_at,ends_at,reason").eq("organization_id", org).order("starts_at"),
      ]);
      return <AvailabilityPanel {...{ professionals, timezone, manage }} shifts={data(shifts) ?? []} blocks={data(blocks) ?? []} />;
    }

    const [bounds, clientsResult, upcomingResult, capacityResult, todayBounds, selectedClientResult] = await Promise.all([
      db.rpc("agenda_calendar_bounds", { org, start_day: period.start, end_day: period.end }).single(),
      db.from("proposal_clients").select("id,name").eq("organization_id", org).order("name").order("id").limit(1000),
      tab === "visao" ? db.from("agenda_appointments").select("*").eq("organization_id", org).in("status", ["pending", "confirmed"])
        .gte("starts_at", new Date().toISOString()).order("starts_at").limit(5) : Promise.resolve({ data: [], error: null }),
      tab === "visao" ? db.rpc("agenda_capacity", { org, day: selected }).single() : Promise.resolve({ data: null, error: null }),
      tab === "visao" ? db.rpc("agenda_calendar_bounds", { org, start_day: selected, end_day: addDays(selected, 1) }).single() : Promise.resolve({ data: null, error: null }),
      clientId ? db.from("proposal_clients").select("id,name").eq("organization_id", org).eq("id", clientId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    const range = data(bounds) as { range_start: string; range_end: string } | null;
    const dayRange = data(todayBounds) as { range_start: string; range_end: string } | null;
    const capacity = data(capacityResult) as { work_minutes: number; occupied_minutes: number } | null;
    const clients = (data(clientsResult) ?? []) as Client[];
    const filteredClient = data(selectedClientResult) as Client | null;
    if (filteredClient && !clients.some((item) => item.id === filteredClient.id)) clients.unshift(filteredClient);
    const upcoming = (data(upcomingResult) ?? []) as Appointment[];
    const appointments: Appointment[] = [];
    for (let offset = 0; ; offset += 500) {
      let batch = db.from("agenda_appointments").select("*").eq("organization_id", org);
      if (range) batch = batch.gte("starts_at", range.range_start).lt("starts_at", range.range_end);
      if (clientId) batch = batch.eq("client_id", clientId);
      const items = data(await batch.order("starts_at").order("id").range(offset, offset + 499)) ?? [];
      appointments.push(...items as Appointment[]);
      if (items.length < 500) break;
    }
    const metricStatuses = ["pending", "confirmed", "completed", "cancelled"] as const;
    const dayCounts = tab === "visao" && dayRange ? await Promise.all([null, ...metricStatuses].map(async (status) => {
      let countQuery = db.from("agenda_appointments").select("id", { count: "exact", head: true })
        .eq("organization_id", org).gte("starts_at", dayRange.range_start).lt("starts_at", dayRange.range_end);
      if (status) countQuery = countQuery.eq("status", status);
      const result = await countQuery;
      if (result.error) throw new Error("Não foi possível contar os agendamentos.");
      return result.count ?? 0;
    })) : [];
    const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? "Serviço";
    const professionalName = (id: string) => professionals.find((p) => p.id === id)?.name ?? "Profissional";
    const clientName = (item: Appointment) => clients.find((c) => c.id === item.client_id)?.name ?? item.guest_name ?? "Cliente";
    const bookingProps = { services, professionals, assignments, clients, today, timezone };
    const itemId = uuid(param("id")) ? param("id") : "";
    const selectedItem = itemId ? data(await db.from("agenda_appointments").select("*").eq("organization_id", org).eq("id", itemId).maybeSingle()) as Appointment | null : null;
    const appointmentCard = (item: Appointment, compact = false) => <Link className="agenda-event" data-status={item.status} href={detailLink(item.id)} key={item.id}>
      <time dateTime={item.starts_at}>{localTime(item.starts_at, timezone)}{!compact && "–" + localTime(item.ends_at, timezone)}</time>
      <strong>{serviceName(item.service_id)}</strong><span>{professionalName(item.professional_id)}{!compact && " · " + clientName(item)}</span>
      <span className="agenda-event-status">{labels[item.status]}</span>
    </Link>;
    const periodTitle = view === "mes" ? displayDay(selected, { month: "long", year: "numeric" }) : view === "dia"
      ? displayDay(selected, { weekday: "long", day: "numeric", month: "long" })
      : displayDay(period.start, { day: "numeric", month: "short" }) + " – " + displayDay(addDays(period.end, -1), { day: "numeric", month: "short" });

    return <>
      {!settings && <div className="agenda-notice"><p>Defina o fuso e o nome público para começar a organizar os atendimentos.</p>
        <Link href={link({ secao: "configuracoes" })}>Abrir configurações <ArrowUpRight size={15} /></Link></div>}
      <div className="agenda-period">
        <div className="agenda-period-title"><span>{tabs[tab]}</span><h1>{periodTitle}</h1></div>
        <div className="agenda-period-controls">
          <Link className="agenda-icon" aria-label="Período anterior" href={dateLink(period.previous)}><ChevronLeft size={19} aria-hidden="true" /></Link>
          <Link className="agenda-icon" aria-label="Próximo período" href={dateLink(period.next)}><ChevronRight size={19} aria-hidden="true" /></Link>
          <Link className="agenda-button agenda-button-secondary" href={dateLink(today)}>Hoje</Link>
          <div className="agenda-segments" aria-label="Período">{(Object.keys(viewLabels) as View[]).map((key) => <Link key={key} aria-current={view === key ? "true" : undefined}
            href={link({ ...filters, periodo: key })}>{viewLabels[key]}</Link>)}</div>
        </div>
      </div>
      {param("novo") === "1" && <section className="agenda-paper"><h2>Novo agendamento</h2><InternalBooking {...bookingProps} initialDay={selected >= today ? selected : today} /></section>}
      {selectedItem && <section className="agenda-paper agenda-detail">
        <div className="agenda-inline"><h2>{serviceName(selectedItem.service_id)}</h2><span className="agenda-pill">{labels[selectedItem.status]}</span></div>
        <p>{clientName(selectedItem)} · {professionalName(selectedItem.professional_id)} · {displayDay(localDay(selectedItem.starts_at, timezone), { day: "numeric", month: "long" })} às {localTime(selectedItem.starts_at, timezone, true)}</p>
        {selectedItem.guest_contact && <p>Contato da reserva: {selectedItem.guest_contact}</p>}
        {selectedItem.notes && <p>Observação: {selectedItem.notes}</p>}
        {(manage || selectedItem.created_by === user) && <>
          <div className="agenda-inline">{transitions[selectedItem.status].map((status) => <AgendaForm key={status} operation="change" id={selectedItem.id} label={actionLabels[status]} quiet>
            <input name="change" type="hidden" value={status} />
          </AgendaForm>)}</div>
          {(["pending", "confirmed"] as Status[]).includes(selectedItem.status) && <details className="agenda-disclosure"><summary>Reagendar</summary>
            <InternalBooking {...bookingProps} appointment={selectedItem} initialDay={localDay(selectedItem.starts_at, timezone) >= today ? localDay(selectedItem.starts_at, timezone) : today} />
          </details>}
          <details className="agenda-disclosure"><summary>Vincular cliente do CLIENTA+</summary><AgendaForm operation="change" id={selectedItem.id} label="Salvar vínculo">
            <input name="change" type="hidden" value="link" /><ClientSelect clients={clients} value={selectedItem.client_id ?? undefined} />
          </AgendaForm></details>
        </>}
        <details className="agenda-disclosure"><summary>Histórico do agendamento</summary><ol className="agenda-history">
          {(data(await db.from("agenda_appointment_events").select("id,kind,created_at,origin").eq("organization_id", org)
            .eq("appointment_id", selectedItem.id).order("created_at", { ascending: false })) ?? []).map((event) => <li key={event.id}>
              {events[event.kind] ?? event.kind} · <time dateTime={event.created_at}>{new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, dateStyle: "short", timeStyle: "short" }).format(new Date(event.created_at))}</time>
            </li>)}
        </ol></details>
        <Link href={link(filters)}>Fechar detalhes</Link>
      </section>}
      {tab === "agendamentos" && <section className="agenda-paper">
        <Form action="/agenda" className="agenda-client-filter">
          <input name="secao" type="hidden" value="agendamentos" /><input name="data" type="hidden" value={selected} /><input name="periodo" type="hidden" value={view} />
          <ClientSelect clients={clients} value={clientId} required={false} />
          <button className="agenda-button agenda-button-secondary">Filtrar</button>
        </Form>
        <details className="agenda-disclosure"><summary>Cadastrar cliente</summary><AgendaForm operation="client" label="Salvar no CLIENTA+">
          <label>Nome<input name="name" required minLength={2} maxLength={180} /></label>
          <label>Tipo<select name="type"><option value="individual">Pessoa física</option><option value="company">Empresa</option></select></label>
          <label>Telefone opcional<input name="phone" type="tel" maxLength={40} /></label>
          <label>E-mail opcional<input name="email" type="email" maxLength={254} /></label>
        </AgendaForm></details>
        <div className="agenda-appointment-list">{appointments.length ? appointments.map((item) => <div key={item.id}>
          <span className="agenda-list-date">{displayDay(localDay(item.starts_at, timezone), { day: "numeric", month: "short" })}</span>
          {appointmentCard(item)}
        </div>) : <p>Nenhum agendamento neste período.</p>}</div>
      </section>}
      {tab !== "agendamentos" && <div className={tab === "visao" ? "agenda-workspace" : ""}>
        <section className={"agenda-calendar agenda-" + view} aria-label="Calendário de agendamentos">
          {period.days.map((day) => {
            const items = appointments.filter((item) => localDay(item.starts_at, timezone) === day);
            const limit = view === "mes" ? 2 : items.length;
            return <div className="agenda-day" key={day} data-selected={day === selected || undefined} data-outside={view === "mes" && day.slice(0, 7) !== selected.slice(0, 7) || undefined}>
              <div className="agenda-day-head">
                <Link href={link({ ...filters, periodo: "dia", data: day })} aria-current={day === today ? "date" : undefined}
                  aria-label={displayDay(day, { weekday: "long", day: "numeric", month: "long" })}>
                  <span>{displayDay(day, { weekday: "short" }).replace(".", "")}</span><strong>{Number(day.slice(-2))}</strong>
                </Link>
                {view !== "mes" && <Link className="agenda-add" href={link({ ...filters, data: day, novo: "1" })} aria-label={"Novo agendamento em " + day}><Plus size={16} aria-hidden="true" /></Link>}
              </div>
              <div className="agenda-day-events">
                {items.slice(0, limit).map((item) => appointmentCard(item, view !== "dia"))}
                {view === "mes" && items.length > 0 && <Link className="agenda-month-count" href={link({ ...filters, periodo: "dia", data: day })}>{items.length} <span>agend.</span></Link>}
                {!items.length && view === "dia" && <p className="agenda-empty">Nenhum atendimento neste dia.</p>}
              </div>
            </div>;
          })}
        </section>
        {tab === "visao" && <aside className="agenda-side">
          <section className="agenda-paper"><h2>Próximos atendimentos</h2>{upcoming.length ? upcoming.map((item) => appointmentCard(item)) : <p>Nenhum atendimento próximo.</p>}</section>
          <section className="agenda-paper"><h2>{selected === today ? "Hoje" : displayDay(selected, { day: "numeric", month: "long" })}</h2>
            <dl className="agenda-stats"><div><dt>Agendamentos</dt><dd>{dayCounts[0]}</dd></div>
              {metricStatuses.map((status, index) => <div key={status}><dt>{labels[status]}</dt><dd>{dayCounts[index + 1]}</dd></div>)}
              <div><dt>Disponibilidade</dt><dd>{capacity?.work_minutes ? `${Math.max(0, capacity.work_minutes - capacity.occupied_minutes)} min` : "Sem turnos"}</dd></div>
              <div><dt>Ocupação</dt><dd>{capacity?.work_minutes ? `${Math.round(capacity.occupied_minutes / capacity.work_minutes * 100)}%` : "—"}</dd></div>
            </dl>
          </section>
        </aside>}
      </div>}
    </>;
  }

  let content;
  try { content = await workspace(); }
  catch { content = <section className="agenda-paper" role="alert"><h1>Agenda indisponível</h1><p>Confira a configuração do AGENDA+ e tente novamente.</p></section>; }
  return <main className="agenda-shell">
    <header className="agenda-header">
      <div className="agenda-brand"><Link href="/" aria-label="Voltar ao ASEX Business Hub"><ArrowLeft size={19} aria-hidden="true" /></Link>
        <CalendarDays size={22} aria-hidden="true" /><strong>Agenda<span>+</span></strong>
      </div>
      <Link className="agenda-button" href={link({ ...Object.fromEntries(["data", "periodo"].filter((key) => param(key)).map((key) => [key, param(key)])),
        secao: ["servicos","profissionais","disponibilidade","configuracoes"].includes(tab) ? "visao" : tab, novo: "1" })}>
        <Plus size={17} aria-hidden="true" /> Novo agendamento
      </Link>
    </header>
    <nav className="agenda-nav" aria-label="AGENDA+">{Object.entries(tabs).map(([key, label]) =>
      <Link key={key} href={link({ secao: key })} aria-current={tab === key ? "page" : undefined}>{label}</Link>)}</nav>
    {content}
  </main>;
}
