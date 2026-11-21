"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Clock3 } from "lucide-react";
import { publicBook, publicSlots } from "../actions";
import { addDays, displayDay, localTime, price, type Catalog, type Slot } from "../../../lib/agenda/model";

const stages = ["Serviço", "Profissional", "Horário", "Seus dados", "Revisão"];
const headings = ["Escolha o serviço", "Escolha o profissional", "Encontre um horário", "Informe seus dados", "Revise a reserva"];

export function BookingJourney({ catalog, today, slug }: { catalog: Catalog; today: string; slug: string }) {
  const [stage, setStage] = useState(0);
  const [serviceId, setService] = useState("");
  const [professionalId, setProfessional] = useState("");
  const [day, setDay] = useState(today);
  const [slot, setSlot] = useState("");
  const [available, setAvailable] = useState<Slot[] | null>(null);
  const [guest, setGuest] = useState("");
  const [channel, setChannel] = useState<"email" | "phone">(catalog.contactMode === "phone" ? "phone" : "email");
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ reference: string; status: string; expiresAt?: string | null } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const service = catalog.services.find((item) => item.id === serviceId);
  const professional = catalog.professionals.find((item) => item.id === professionalId);
  const bookable = catalog.services.filter((item) => catalog.professionals.some((person) => person.services.includes(item.id)));

  useEffect(() => {
    if (stage || result) heading.current?.focus();
  }, [stage, result]);

  useEffect(() => {
    if (stage !== 2 || !serviceId || !professionalId || !day) return;
    let active = true;
    publicSlots(slug, serviceId, professionalId, day).then((response) => {
      if (!active) return;
      setAvailable(response.slots ?? []);
      setError(response.error ?? "");
    }).catch(() => {
      if (active) { setAvailable([]); setError("Falha ao consultar os horários. Volte e tente novamente."); }
    });
    return () => { active = false; };
  }, [day, professionalId, serviceId, slug, stage]);

  function go(next: number) {
    setError("");
    if (next === 2) { setAvailable(null); setSlot(""); }
    setStage(next);
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || result) return;
    setPending(true);
    setError("");
    try {
      const response = await publicBook(slug, serviceId, professionalId, slot, guest.trim(), contact.trim(), channel);
      if (response.reference) setResult({ reference: response.reference, status: response.status ?? "pending", expiresAt: response.expires_at });
      else setError(response.error ?? "Não foi possível confirmar.");
    } catch { setError("Falha na conexão. Confira novamente antes de enviar."); }
    finally { setPending(false); }
  }

  if (!bookable.length) return <section className="agenda-paper"><h2>Reservas indisponíveis no momento</h2>
    <p>A empresa ainda não disponibilizou serviços com profissionais para agendamento online.</p></section>;

  if (result) return <section className="agenda-paper agenda-confirmation">
    <CircleCheck size={42} aria-hidden="true" />
    <h2 tabIndex={-1} ref={heading}>{result.status === "confirmed" ? "Reserva confirmada" : "Solicitação recebida"}</h2>
    <p>{service?.name} com {professional?.name}, em {displayDay(day, { day: "numeric", month: "long" })} às {localTime(slot, catalog.timezone, true)}.</p>
    {result.status !== "confirmed" && <p>A empresa ainda precisa confirmar o atendimento{result.expiresAt ? " até " + localTime(result.expiresAt, catalog.timezone, true) : ""}.</p>}
    <p>Referência da reserva <code>{result.reference}</code></p>
  </section>;

  return <div className="agenda-public-grid">
    <section className="agenda-paper agenda-journey">
      <ol className="agenda-steps" aria-label="Progresso da reserva">{stages.map((label, index) => <li key={label}
        aria-current={stage === index ? "step" : undefined} data-complete={index < stage || undefined}>
        <span>{index < stage ? <Check size={13} aria-hidden="true" /> : index + 1}</span><span>{label}</span>
      </li>)}</ol>
      {service && stage > 0 && <div className="agenda-mobile-summary" aria-label="Resumo da reserva">
        <strong>{service.name}</strong>
        {slot && <span>{displayDay(day, { day: "numeric", month: "short" })} · {localTime(slot, catalog.timezone, true)}</span>}
      </div>}
      <div className="agenda-journey-stage" key={stage}>
        <h2 tabIndex={-1} ref={heading}>{headings[stage]}</h2>
        {stage === 0 && <div className="agenda-options">
          {bookable.map((item) => <button className="agenda-choice" type="button" key={item.id} onClick={() => {
            setService(item.id); setProfessional(""); go(1);
          }}><span><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}
            <small><Clock3 size={14} aria-hidden="true" /> {item.duration} min{item.price === null ? "" : " · " + price(item.price)}</small>
          </span><ArrowRight size={18} aria-hidden="true" /></button>)}
        </div>}
        {stage === 1 && <div className="agenda-options">
          {catalog.professionals.filter((item) => item.services.includes(serviceId)).map((item) =>
            <button className="agenda-choice" type="button" key={item.id} onClick={() => { setProfessional(item.id); go(2); }}>
              <span><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}</span><ArrowRight size={18} aria-hidden="true" />
            </button>)}
        </div>}
        {stage === 2 && <>
          <label>Data do atendimento<input type="date" value={day} min={today} max={addDays(today, catalog.maxDays)}
            onChange={(event) => { setDay(event.target.value); setSlot(""); setAvailable(null); setError(""); }} /></label>
          <p className="agenda-quiet">Horários em {catalog.timezone}</p>
          {!day ? <p>Selecione uma data.</p> : available === null ? <div aria-busy="true">
            <p role="status">Consultando horários…</p><div className="agenda-skeleton" aria-hidden="true" />
          </div> : available.length === 0 && !error ? <p>Nenhum horário disponível. Escolha outra data.</p> :
            <fieldset className="agenda-slots"><legend>Horários disponíveis</legend>{available.map((item) =>
              <label className="agenda-slot" key={item.starts_at}><input type="radio" name="slot" value={item.starts_at} checked={slot === item.starts_at}
                onChange={() => setSlot(item.starts_at)} /><span>{localTime(item.starts_at, catalog.timezone, true)}</span></label>
            )}</fieldset>}
          <button className="agenda-button" disabled={!slot} type="button" onClick={() => go(3)}>Continuar <ArrowRight size={17} aria-hidden="true" /></button>
        </>}
        {stage === 3 && <form className="agenda-public-form" onSubmit={(event) => { event.preventDefault(); if (guest.trim().length >= 2) go(4); }}>
          <label>Nome<input autoComplete="name" value={guest} onChange={(event) => setGuest(event.target.value)} required minLength={2} maxLength={120} /></label>
          {catalog.contactMode === "either" && <label>Como a empresa pode entrar em contato?<select value={channel} onChange={(event) => {
            setChannel(event.target.value as "email" | "phone"); setContact("");
          }}><option value="email">E-mail</option><option value="phone">Telefone</option></select></label>}
          <label>{channel === "email" ? "E-mail" : "Telefone"}<input type={channel === "email" ? "email" : "tel"} autoComplete={channel === "email" ? "email" : "tel"}
            value={contact} onChange={(event) => setContact(event.target.value)} required maxLength={channel === "email" ? 254 : 30} /></label>
          <p className="agenda-quiet">Seu nome e contato são usados pela empresa para organizar este atendimento.</p>
          <button className="agenda-button" type="submit">Revisar reserva</button>
        </form>}
        {stage === 4 && <form className="agenda-public-form" onSubmit={confirm}>
          <p>{guest} · {contact}</p>
          <p>{service?.name} com {professional?.name} em {displayDay(day, { weekday: "long", day: "numeric", month: "long" })} às {localTime(slot, catalog.timezone, true)}.</p>
          {catalog.policy && <p className="agenda-policy"><strong>Política de cancelamento</strong>{catalog.policy}</p>}
          <button type="submit" className="agenda-button" disabled={pending}>{pending ? "Enviando…" : "Enviar reserva"}</button>
        </form>}
        {error && <p role="alert" className="agenda-feedback">{error}</p>}
        {stage > 0 && <button type="button" className="agenda-back" disabled={pending} onClick={() => go(stage - 1)}><ArrowLeft size={15} aria-hidden="true" /> Voltar</button>}
      </div>
    </section>
    <aside className="agenda-paper agenda-booking-summary" aria-label="Resumo da reserva">
      <h2>Sua reserva</h2>
      {service ? <dl className="agenda-stats">
        <div><dt>Serviço</dt><dd>{service.name}</dd></div>
        <div><dt>Duração</dt><dd>{service.duration} min</dd></div>
        {service.price !== null && <div><dt>Preço</dt><dd>{price(service.price)}</dd></div>}
        {professional && <div><dt>Profissional</dt><dd>{professional.name}</dd></div>}
        {slot && <div><dt>Horário</dt><dd>{displayDay(day, { day: "numeric", month: "short" })} · {localTime(slot, catalog.timezone)}</dd></div>}
      </dl> : <p>Escolha um serviço para iniciar.</p>}
    </aside>
  </div>;
}
