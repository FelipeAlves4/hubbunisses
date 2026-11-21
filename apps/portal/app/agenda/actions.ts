"use server";

import { revalidatePath } from "next/cache";
import { getApplicationAccess } from "../../lib/application-access";
import { createClient } from "../../lib/supabase/server";
import { instant, isDay, slug, unambiguousInstant, uuid, type ActionResult, type Slot } from "../../lib/agenda/model";

async function context() {
  const access = await getApplicationAccess("agenda-plus");
  return { ...access, db: await createClient() };
}

function message(error: { code?: string }) {
  switch (error.code) {
    case "23P01": return "Este horário não está mais disponível. Escolha outro.";
    case "23505": return "Já existe um registro com esses dados.";
    case "23503": return "Selecione registros que pertençam à organização.";
    case "42501": return "Você não tem permissão para esta operação.";
    default: return "Confira os dados e tente novamente. Verifique também se a agenda está configurada.";
  }
}

export async function internalSlots(service: string, professional: string, day: string, ignore?: string): Promise<{ slots?: Slot[]; error?: string }> {
  if (!uuid(service) || !uuid(professional) || !isDay(day) || (ignore && !uuid(ignore))) return { error: "Selecione serviço, profissional e data válidos." };
  try {
    const { db, organizationId } = await context();
    const { data, error } = await db.rpc("agenda_available_slots", { org: organizationId, service, professional, day, ignore_id: ignore || null });
    return error ? { error: message(error) } : { slots: data ?? [] };
  } catch { return { error: "Sessão ou acesso à agenda indisponível." }; }
}

export async function saveAgenda(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { db, organizationId, role } = await context();
    const value = (key: string) => String(form.get(key) ?? "").trim();
    const optional = (key: string) => value(key) || null;
    const id = value("id");
    const operation = value("operation");
    if (id && !uuid(id)) return { error: "Registro inválido." };
    const number = (key: string, min: number, max: number) => {
      const raw = value(key);
      const count = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isInteger(count) || count < min || count > max) throw new Error(`Informe um número entre ${min} e ${max}.`);
      return count;
    };
    const name = value("name");
    const description = optional("description");
    const start = value("starts_at");
    const professional = value("professional");
    const service = value("service");
    const client = value("client");
    let result;

    if (operation === "book") {
      if (!instant(start) || ![professional, service, client].every(uuid)) return { error: "Selecione cliente, serviço, profissional e horário." };
      result = await db.rpc("agenda_book_internal", { org: organizationId, service, professional, start_at: start, client, notes: optional("notes") });
    } else if (operation === "change") {
      const action = value("change");
      if (!id || (action === "reschedule" && (!instant(start) || !uuid(professional))) || (action === "link" && !uuid(client))) return { error: "Selecione os dados do agendamento." };
      result = await db.rpc("agenda_change", { org: organizationId, appointment: id, action, new_start: start || null, new_professional: professional || null, new_client: client || null });
    } else if (operation === "client") {
      if (name.length < 2 || name.length > 180) return { error: "Informe o nome do cliente." };
      result = await db.from("proposal_clients").insert({
        organization_id: organizationId, name, type: value("type") === "company" ? "company" : "individual",
        email: optional("email"), phone: optional("phone"),
      });
    } else {
      if (role !== "owner" && role !== "admin") return { error: "Esta configuração exige um administrador." };
      switch (operation) {
        case "settings": {
          if (name.length < 2 || name.length > 120 || !slug(value("slug"))) return { error: "Informe o nome público e um identificador de 3 a 64 caracteres." };
          try { new Intl.DateTimeFormat("pt-BR", { timeZone: value("timezone") }); }
          catch { return { error: "Informe um fuso IANA válido, como America/Sao_Paulo." }; }
          const fields = {
            public_name: name, slug: value("slug"), timezone: value("timezone"), public_enabled: form.has("public_enabled"),
            min_notice_minutes: number("min_notice_minutes", 0, 10080), max_days: number("max_days", 1, 180),
            cancellation_policy: optional("cancellation_policy"), show_prices: form.has("show_prices"),
            auto_confirm: form.has("auto_confirm"), contact_mode: value("contact_mode"),
          };
          result = value("existing") === "yes"
            ? await db.from("agenda_settings").update(fields).eq("organization_id", organizationId).select("organization_id").single()
            : await db.from("agenda_settings").insert({ organization_id: organizationId, ...fields });
          break;
        }
        case "service":
        case "professional": {
          if (name.length < 2 || name.length > 120) return { error: "O nome deve ter de 2 a 120 caracteres." };
          const table = operation === "service" ? "agenda_services" : "agenda_professionals";
          const fields = { name, description, active: form.has("active") };
          const data = operation === "service"
            ? { ...fields, duration_minutes: number("duration_minutes", 5, 480), price_cents: value("price_cents") ? number("price_cents", 0, 100000000) : null }
            : { ...fields, member_id: optional("member_id") };
          result = id ? await db.from(table).update(data).eq("organization_id", organizationId).eq("id", id).select("id").single()
            : await db.from(table).insert({ organization_id: organizationId, ...data });
          break;
        }
        case "assign":
        case "unassign": {
          if (!uuid(professional) || !uuid(service)) return { error: "Selecione serviço e profissional." };
          const fields = { professional_id: professional, service_id: service, organization_id: organizationId };
          result = operation === "assign" ? await db.from("agenda_professional_services").insert(fields)
            : await db.from("agenda_professional_services").delete().match(fields).select("service_id").single();
          break;
        }
        case "shift":
        case "timeoff": {
          if (!uuid(professional)) return { error: "Selecione um profissional." };
          const localDate = optional("local_date");
          if (localDate && !isDay(localDate)) return { error: "Informe uma data válida." };
          let shiftStart: string | null = null;
          let shiftEnd: string | null = null;
          if (operation === "timeoff") {
            const settings = await db.from("agenda_settings").select("timezone").eq("organization_id", organizationId).maybeSingle();
            if (settings.error || !settings.data) return { error: "Configure o fuso da agenda antes de criar bloqueios." };
            shiftStart = instant(start) ? start : unambiguousInstant(start, settings.data.timezone);
            const end = value("ends_at");
            shiftEnd = instant(end) ? end : unambiguousInstant(end, settings.data.timezone);
            if (!shiftStart || !shiftEnd || Date.parse(shiftStart) >= Date.parse(shiftEnd)) return { error: "Informe um intervalo válido. Horários inexistentes ou ambíguos em transições de fuso devem ser ajustados." };
          }
          const fields = operation === "shift"
            ? { local_date: localDate, weekday: localDate ? null : number("weekday", 0, 6), start_time: value("start_time"), end_time: value("end_time") }
            : { starts_at: shiftStart, ends_at: shiftEnd, reason: optional("reason") };
          result = await db.from(operation === "shift" ? "agenda_working_hours" : "agenda_time_off")
            .insert({ organization_id: organizationId, professional_id: professional, ...fields });
          break;
        }
        case "remove-shift":
        case "remove-timeoff": {
          if (!id) return { error: "Registro inválido." };
          result = await db.from(operation === "remove-shift" ? "agenda_working_hours" : "agenda_time_off")
            .delete().eq("organization_id", organizationId).eq("id", id).select("id").single();
          break;
        }
        default: return { error: "Operação inválida." };
      }
    }
    if (result.error) return { error: message(result.error) };
    revalidatePath("/agenda");
    return { ok: operation === "book" ? "Agendamento confirmado." : "Alteração salva." };
  } catch (error) {
    return { error: error instanceof Error && error.message.startsWith("Informe um número") ? error.message : "Confira os dados e o acesso à agenda." };
  }
}

export async function findAgendaClients(query: string) {
  if (typeof query !== "string" || query.trim().length < 2 || query.length > 100) return [];
  try {
    const { db, organizationId } = await context();
    const term = query.trim().replace(/[\\%_]/g, "\\$&");
    const { data, error } = await db.from("proposal_clients").select("id,name").eq("organization_id", organizationId)
      .ilike("name", "%" + term + "%").order("name").order("id").limit(30);
    return error ? [] : data ?? [];
  } catch { return []; }
}
