import { AgendaForm } from "./forms";
import { price, type Assignment, type Professional, type Service, type Settings } from "../../lib/agenda/model";

type Shift = { id: string; professional_id: string; weekday: number | null; local_date: string | null; start_time: string; end_time: string };
type Block = { id: string; professional_id: string; starts_at: string; ends_at: string; reason: string | null };
export const weekdays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function ProfessionalOptions({ items }: { items: Professional[] }) {
  return <select name="professional" required><option value="">Selecione</option>{items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>;
}

export function SettingsPanel({ settings, manage }: { settings: Settings | null; manage: boolean }) {
  return <section className="agenda-paper"><h2>Configurações</h2>
    {settings?.public_enabled && <p><a href={"/agendar/" + settings.slug}>Abrir página pública</a></p>}
    {manage ? <AgendaForm operation="settings" label="Salvar configurações">
      <input type="hidden" name="existing" value={settings ? "yes" : "no"} />
      <label>Nome público<input name="name" required minLength={2} maxLength={120} defaultValue={settings?.public_name} /></label>
      <label>Identificador público<input name="slug" required pattern="[a-z0-9][a-z0-9\-]{1,62}[a-z0-9]" defaultValue={settings?.slug} placeholder="nome-da-empresa" /></label>
      <label>Fuso IANA<input name="timezone" required defaultValue={settings?.timezone ?? "America/Sao_Paulo"} /></label>
      <label>Antecedência mínima (min)<input name="min_notice_minutes" type="number" min={0} max={10080} required defaultValue={settings?.min_notice_minutes ?? 60} /></label>
      <label>Janela futura (dias)<input name="max_days" type="number" min={1} max={180} required defaultValue={settings?.max_days ?? 30} /></label>
      <label>Contato na reserva<select name="contact_mode" defaultValue={settings?.contact_mode ?? "either"}>
        <option value="either">Telefone ou e-mail</option><option value="email">E-mail</option><option value="phone">Telefone</option>
      </select></label>
      <label className="agenda-wide">Política de cancelamento<textarea name="cancellation_policy" maxLength={1200} defaultValue={settings?.cancellation_policy ?? ""} /></label>
      <label className="agenda-check"><input type="checkbox" name="public_enabled" defaultChecked={settings?.public_enabled} /> Página pública ativa</label>
      <label className="agenda-check"><input type="checkbox" name="show_prices" defaultChecked={settings?.show_prices} /> Exibir preços</label>
      <label className="agenda-check"><input type="checkbox" name="auto_confirm" defaultChecked={settings?.auto_confirm} /> Confirmar reservas públicas automaticamente</label>
    </AgendaForm> : <p>Um administrador da organização pode editar as configurações.</p>}
  </section>;
}

export function ServicesPanel({ services, manage }: { services: Service[]; manage: boolean }) {
  const edit = (item?: Service) => <AgendaForm operation="service" id={item?.id} label={item ? "Salvar serviço" : "Cadastrar serviço"}>
    <label>Nome<input name="name" minLength={2} maxLength={120} required defaultValue={item?.name} /></label>
    <label>Duração (min)<input name="duration_minutes" type="number" min={5} max={480} required defaultValue={item?.duration_minutes ?? 30} /></label>
    <label>Preço opcional (centavos)<input type="number" name="price_cents" min={0} max={100000000} defaultValue={item?.price_cents ?? ""} /></label>
    <label>Descrição pública<textarea name="description" maxLength={1000} defaultValue={item?.description ?? ""} /></label>
    <label className="agenda-check"><input type="checkbox" name="active" defaultChecked={item?.active ?? true} /> Serviço ativo</label>
  </AgendaForm>;
  return <section className="agenda-paper"><h2>Serviços</h2>
    {manage && <details className="agenda-disclosure"><summary>Novo serviço</summary>{edit()}</details>}
    {!services.length && <p>Nenhum serviço cadastrado.</p>}
    <ul className="agenda-records">{services.map((item) => <li key={item.id}><div><strong>{item.name}</strong><p>
      {item.duration_minutes} min · {item.price_cents === null ? "Preço sob consulta" : price(item.price_cents)} · {item.active ? "Ativo" : "Inativo"}
    </p></div>{manage && <details><summary>Editar</summary>{edit(item)}</details>}</li>)}</ul>
  </section>;
}

export function ProfessionalsPanel({ professionals, services, assignments, members, manage }: {
  professionals: Professional[]; services: Service[]; assignments: Assignment[]; members: string[]; manage: boolean;
}) {
  const edit = (item?: Professional) => <AgendaForm operation="professional" id={item?.id} label={item ? "Salvar profissional" : "Cadastrar profissional"}>
    <label>Nome<input name="name" minLength={2} maxLength={120} required defaultValue={item?.name} /></label>
    <label>Especialidade pública<textarea name="description" maxLength={1000} defaultValue={item?.description ?? ""} /></label>
    <label>Membro vinculado<select name="member_id" defaultValue={item?.member_id ?? ""}><option value="">Sem vínculo</option>
      {members.map((id) => <option value={id} key={id}>{id}</option>)}</select></label>
    <label className="agenda-check"><input type="checkbox" name="active" defaultChecked={item?.active ?? true} /> Profissional ativo</label>
  </AgendaForm>;
  return <section className="agenda-paper"><h2>Profissionais</h2>
    {manage && <details className="agenda-disclosure"><summary>Novo profissional</summary>{edit()}</details>}
    {!professionals.length && <p>Nenhum profissional cadastrado.</p>}
    <ul className="agenda-records">{professionals.map((item) => {
      const linked = assignments.filter((a) => a.professional_id === item.id);
      const remaining = services.filter((s) => !linked.some((a) => a.service_id === s.id));
      return <li key={item.id}><div><strong>{item.name}</strong><p>{item.description || (item.active ? "Ativo" : "Inativo")}</p></div>
        <details><summary>Serviços e perfil</summary>
          {manage && edit(item)}
          <h3>Serviços habilitados</h3>
          {linked.length === 0 && <p>Nenhum serviço vinculado.</p>}
          {linked.map((a) => <div className="agenda-inline" key={a.service_id}><span>{services.find((s) => s.id === a.service_id)?.name}</span>
            {manage && <AgendaForm operation="unassign" label="Remover vínculo" quiet>
              <input type="hidden" name="professional" value={item.id} /><input type="hidden" name="service" value={a.service_id} />
            </AgendaForm>}
          </div>)}
          {manage && remaining.length > 0 && <AgendaForm operation="assign" label="Vincular serviço">
            <input type="hidden" name="professional" value={item.id} />
            <label>Serviço<select name="service" required><option value="">Selecione</option>{remaining.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          </AgendaForm>}
        </details>
      </li>;
    })}</ul>
  </section>;
}

export function AvailabilityPanel({ professionals, shifts, blocks, timezone, manage }: {
  professionals: Professional[]; shifts: Shift[]; blocks: Block[]; timezone: string; manage: boolean;
}) {
  const name = (id: string) => professionals.find((p) => p.id === id)?.name ?? "Profissional";
  const format = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, dateStyle: "short", timeStyle: "short" });
  return <div className="agenda-split">
    <section className="agenda-paper"><h2>Turnos de atendimento</h2><p>Cadastre turnos separados para pausas. Um turno com data substitui os turnos semanais daquele dia.</p>
      {manage && <details className="agenda-disclosure"><summary>Adicionar turno</summary><AgendaForm operation="shift" label="Salvar turno">
        <label>Profissional<ProfessionalOptions items={professionals} /></label>
        <label>Dia da semana<select name="weekday">{weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
        <label>Data de exceção (opcional)<input type="date" name="local_date" /></label>
        <label>Início<input type="time" name="start_time" required /></label><label>Fim<input type="time" name="end_time" required /></label>
      </AgendaForm></details>}
      {!shifts.length && <p>Nenhum turno definido.</p>}
      <ul className="agenda-records">{shifts.map((shift) => <li key={shift.id}><div><strong>{name(shift.professional_id)}</strong><p>
        {shift.local_date || weekdays[shift.weekday ?? 0]} · {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}
      </p></div>{manage && <AgendaForm operation="remove-shift" id={shift.id} label="Remover turno" quiet />}</li>)}</ul>
    </section>
    <section className="agenda-paper"><h2>Bloqueios e folgas</h2><p>Os bloqueios retiram horários da disponibilidade sem apagar agendamentos existentes.</p>
      {manage && <details className="agenda-disclosure"><summary>Adicionar bloqueio</summary><AgendaForm operation="timeoff" label="Salvar bloqueio">
        <label>Profissional<ProfessionalOptions items={professionals} /></label>
        <label>Início ({timezone})<input type="datetime-local" name="starts_at" required /></label>
        <label>Fim ({timezone})<input type="datetime-local" name="ends_at" required /></label>
        <label>Motivo opcional<input name="reason" maxLength={300} /></label>
      </AgendaForm></details>}
      {!blocks.length && <p>Nenhum bloqueio programado.</p>}
      <ul className="agenda-records">{blocks.map((item) => <li key={item.id}><div><strong>{name(item.professional_id)}</strong>
        <p>{format.format(new Date(item.starts_at))} — {format.format(new Date(item.ends_at))}</p>{item.reason && <p>{item.reason}</p>}
      </div>{manage && <AgendaForm operation="remove-timeoff" id={item.id} label="Remover bloqueio" quiet />}</li>)}</ul>
    </section>
  </div>;
}
