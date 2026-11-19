"use server";

import { revalidatePath } from "next/cache";
import { ApplicationAccessError, getApplicationAccess } from "../../lib/application-access";
import { createClient } from "../../lib/supabase/server";
import { toClientValues, type ClientInput } from "./client-input";

type Result = { ok: true; message: string } | { ok: false; message: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const stages = ["new_lead", "contact_started", "qualification", "proposal_sent", "negotiation", "won", "lost"] as const;
const priorities = ["low", "medium", "high"] as const;
const activityTypes = ["call", "whatsapp", "email", "meeting", "note", "follow_up"] as const;

export type { ClientInput } from "./client-input";
export type OpportunityInput = { id?: string; clientId: string; title: string; description?: string; estimatedValueCents: number; stage: (typeof stages)[number]; priority: (typeof priorities)[number]; expectedCloseDate?: string | null; nextContactDate?: string | null };
export type ActivityInput = { opportunityId: string; activityType: (typeof activityTypes)[number]; body?: string; dueDate?: string | null };

function failure(error: unknown): Result {
  if (error instanceof ApplicationAccessError) return { ok: false, message: "Sua sessão não tem acesso ao CLIENTA+." };
  return { ok: false, message: error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente." };
}
function text(value: string | undefined, max: number, field: string, min = 0) {
  const result = value?.trim().replace(/\s+/g, " ") || "";
  if (result.length < min || result.length > max) throw new Error(`${field} deve ter entre ${min} e ${max} caracteres.`);
  return result || null;
}
function isoDate(value: string | null | undefined, field: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T12:00:00Z`))) throw new Error(`${field} inválida.`);
  return value;
}

export async function saveClientAction(input: ClientInput): Promise<Result> {
  try {
    const { organizationId, userId } = await getApplicationAccess("clienta-plus");
    if (input.id && !UUID.test(input.id)) throw new Error("Cliente inválido.");
    if (input.type !== "individual" && input.type !== "company") throw new Error("Tipo de cliente inválido.");
    const values = toClientValues(input);
    const supabase = await createClient();
    if (input.id) {
      const { data, error } = await supabase.from("proposal_clients").update(values).eq("id", input.id).eq("organization_id", organizationId).select("id").maybeSingle();
      if (error) throw new Error(error.message); if (!data) throw new Error("Cliente não encontrado ou sem permissão para editar.");
    } else {
      const { error } = await supabase.from("proposal_clients").insert({ ...values, organization_id: organizationId, created_by: userId });
      if (error) throw new Error(error.message);
    }
    revalidatePath("/clientes"); return { ok: true, message: input.id ? "Cliente atualizado." : "Cliente cadastrado e disponível no PROPOSTA+." };
  } catch (error) { return failure(error); }
}

export async function saveOpportunityAction(input: OpportunityInput): Promise<Result> {
  try {
    const { organizationId, userId } = await getApplicationAccess("clienta-plus");
    if (!UUID.test(input.clientId) || (input.id && !UUID.test(input.id))) throw new Error("Oportunidade ou cliente inválido.");
    if (!stages.includes(input.stage) || !priorities.includes(input.priority)) throw new Error("Etapa ou prioridade inválida.");
    if (!Number.isSafeInteger(input.estimatedValueCents) || input.estimatedValueCents < 0 || input.estimatedValueCents > 99_999_999_999_999) throw new Error("Valor estimado inválido.");
    const values = { client_id: input.clientId, title: text(input.title, 220, "Título", 2), description: text(input.description, 8000, "Descrição"), estimated_value_cents: input.estimatedValueCents, stage: input.stage, priority: input.priority, expected_close_date: isoDate(input.expectedCloseDate, "Data prevista"), next_contact_date: isoDate(input.nextContactDate, "Próximo contato") };
    const supabase = await createClient();
    if (input.id) {
      const { data, error } = await supabase.from("crm_opportunities").update(values).eq("id", input.id).eq("organization_id", organizationId).select("id").maybeSingle();
      if (error) throw new Error(error.message); if (!data) throw new Error("Oportunidade não encontrada ou sem permissão para editar.");
    } else {
      const { error } = await supabase.from("crm_opportunities").insert({ ...values, organization_id: organizationId, created_by: userId });
      if (error) throw new Error(error.message);
    }
    revalidatePath("/clientes"); return { ok: true, message: input.id ? "Oportunidade atualizada." : "Oportunidade criada." };
  } catch (error) { return failure(error); }
}

export async function addActivityAction(input: ActivityInput): Promise<Result> {
  try {
    const { organizationId, userId } = await getApplicationAccess("clienta-plus");
    if (!UUID.test(input.opportunityId) || !activityTypes.includes(input.activityType)) throw new Error("Atividade inválida.");
    const dueDate = isoDate(input.dueDate, "Prazo");
    if (input.activityType === "follow_up" && !dueDate) throw new Error("Informe o prazo do acompanhamento.");
    const supabase = await createClient();
    const { error } = await supabase.from("crm_activities").insert({ organization_id: organizationId, opportunity_id: input.opportunityId, created_by: userId, activity_type: input.activityType, body: text(input.body, 8000, "Descrição"), due_date: dueDate });
    if (error) throw new Error(error.message);
    revalidatePath("/clientes"); return { ok: true, message: input.activityType === "follow_up" ? "Acompanhamento agendado." : "Atividade registrada." };
  } catch (error) { return failure(error); }
}

export async function completeFollowUpAction(id: string): Promise<Result> {
  try {
    const { organizationId } = await getApplicationAccess("clienta-plus");
    if (!UUID.test(id)) throw new Error("Acompanhamento inválido.");
    const supabase = await createClient();
    const { data, error } = await supabase.from("crm_activities").update({ completed_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organizationId).eq("activity_type", "follow_up").is("completed_at", null).select("id").maybeSingle();
    if (error) throw new Error(error.message); if (!data) throw new Error("Acompanhamento não encontrado ou já concluído.");
    revalidatePath("/clientes"); return { ok: true, message: "Acompanhamento concluído." };
  } catch (error) { return failure(error); }
}
