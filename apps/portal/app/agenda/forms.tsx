"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { saveAgenda, internalSlots, findAgendaClients } from "./actions";
import { localTime, type Appointment, type Assignment, type Client, type Professional, type Service, type Slot } from "../../lib/agenda/model";

export function AgendaForm({ operation, id, label, children, quiet = false }: {
  operation: string; id?: string; label: string; children?: ReactNode; quiet?: boolean;
}) {
  const [result, action, pending] = useActionState(saveAgenda, {});
  return <form action={action} className={quiet ? "agenda-form agenda-form-inline" : "agenda-form"}>
    <input type="hidden" name="operation" value={operation} />
    {id && <input type="hidden" name="id" value={id} />}
    <fieldset disabled={pending}>
      {children}
      <button className={quiet ? "agenda-button agenda-button-secondary" : "agenda-button"} type="submit" disabled={pending}>{pending ? "Salvando…" : label}</button>
    </fieldset>
    <div aria-live="polite">{result.error && <p className="agenda-feedback" role="alert">{result.error}</p>}
      {result.ok && <p className="agenda-feedback agenda-success">{result.ok}</p>}</div>
  </form>;
}

export function ClientSelect({ clients, value, required = true }: { clients: Client[]; value?: string; required?: boolean }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(clients.find((item) => item.id === value));
  const [matches, setMatches] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) return;
    let current = true;
    const timer = window.setTimeout(() => {
      findAgendaClients(query).then((result) => {
        if (current) { setMatches(result); setLoading(false); }
      }).catch(() => { if (current) { setMatches([]); setLoading(false); } });
    }, 240);
    return () => { current = false; window.clearTimeout(timer); };
  }, [query]);
  const options = query.trim().length >= 2 ? matches : clients;
  const visible = selected && !options.some((item) => item.id === selected.id) ? [selected, ...options] : options;
  return <>
    <label>Buscar cliente<input type="search" value={query} maxLength={100} onChange={(event) => {
      setQuery(event.target.value); setMatches([]); setLoading(event.target.value.trim().length >= 2);
    }} placeholder="Digite pelo menos 2 caracteres" /></label>
    <label>Cliente<select name={required ? "client" : "cliente"} value={selected?.id ?? ""} required={required}
      onChange={(event) => setSelected(visible.find((item) => item.id === event.target.value))}>
      <option value="">{required ? "Selecione" : "Todos os clientes"}</option>
      {visible.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    {query.trim().length >= 2 && <p role="status">{loading ? "Buscando clientes…" : `${matches.length} resultado(s)`}</p>}
  </>;
}

export function InternalBooking({ services, professionals, assignments, clients, today, timezone, appointment, initialDay }: {
  services: Service[]; professionals: Professional[]; assignments: Assignment[]; clients: Client[];
  today: string; timezone: string; appointment?: Appointment; initialDay?: string;
}) {
  const [service, setService] = useState(appointment?.service_id ?? "");
  const [professional, setProfessional] = useState(appointment?.professional_id ?? "");
  const [day, setDay] = useState(initialDay ?? today);
  const [slot, setSlot] = useState("");
  const [availability, setAvailability] = useState<{ slots?: Slot[]; error?: string } | null>(null);
  useEffect(() => {
    let current = true;
    if (service && professional && day)
      internalSlots(service, professional, day, appointment?.id).then((result) => { if (current) setAvailability(result); })
        .catch(() => { if (current) setAvailability({ error: "Falha ao consultar horários." }); });
    return () => { current = false; };
  }, [service, professional, day, appointment?.id]);
  const reset = () => { setSlot(""); setAvailability(null); };
  return <AgendaForm operation={appointment ? "change" : "book"} id={appointment?.id} label={appointment ? "Salvar reagendamento" : "Confirmar agendamento"}>
    {appointment && <input type="hidden" name="change" value="reschedule" />}
    {!appointment && <ClientSelect clients={clients} />}
    {!appointment && <label>Serviço<select name="service" value={service} required onChange={(event) => {
      setService(event.target.value); setProfessional(""); reset();
    }}><option value="">Selecione</option>{services.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes} min</option>)}</select></label>}
    <label>Profissional<select name="professional" value={professional} required onChange={(event) => {
      if (event.target.value !== professional) { setProfessional(event.target.value); reset(); }
    }}><option value="">Selecione</option>
      {professionals.filter((p) => p.active && assignments.some((item) => item.service_id === service && item.professional_id === p.id))
        .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select></label>
    <label>Data<input type="date" min={today} value={day} required onChange={(event) => {
      if (event.target.value !== day) { setDay(event.target.value); reset(); }
    }} /></label>
    <label>Horário ({timezone})<select name="starts_at" required value={slot} onChange={(event) => setSlot(event.target.value)}>
      <option value="">Selecione</option>{availability?.slots?.map((item) => <option key={item.starts_at} value={item.starts_at}>
        {localTime(item.starts_at, timezone, true)}
      </option>)}
    </select></label>
    {service && professional && day && <p aria-live="polite">{availability === null ? "Consultando horários…" :
      availability.error || (!availability.slots?.length ? "Sem horários disponíveis nesta data." : "")}</p>}
    {!appointment && <label>Observação interna<textarea name="notes" maxLength={1000} /></label>}
  </AgendaForm>;
}
