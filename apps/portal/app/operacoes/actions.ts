"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getApplicationAccess } from "../../lib/application-access";
import { createClient } from "../../lib/supabase/server";
import { isUuid, parseAmount, priorities, statuses } from "./model";

type Result = { error?: string; success?: string };
const read = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const optional = (form: FormData, key: string) => read(form, key) || null;

const errors: Record<string, string> = {
  "23503": "Confirme o cliente, a proposta e os responsáveis da organização.",
  "23505": "Já existe um registro com esse vínculo.",
  "23514": "Confira os campos, as datas e a aprovação da proposta vinculada.",
  "22007": "Informe datas válidas.",
  "22008": "Informe datas válidas.",
  "42501": "Você não tem permissão para esta alteração.",
};

export async function mutateOperation(_: Result, form: FormData): Promise<Result> {
  let destination: string | undefined;
  try {
    const { organizationId, userId } = await getApplicationAccess("opera-plus");
    const db = await createClient();
    const operation = read(form, "operation");
    const id = read(form, "id");
    if (!isUuid(id)) return { error: "Registro inválido." };

    if (operation === "create" || operation === "edit" || operation === "status") {
      const status = read(form, "status");
      if (!Object.hasOwn(statuses, status)) return { error: "Selecione um status válido." };
      if (operation === "status") {
        const { data, error } = await db.from("service_orders").update({ status })
          .eq("organization_id", organizationId).eq("id", id).select("id").maybeSingle();
        if (error || !data) return { error: errors[error?.code ?? "42501"] ?? "Falha ao atualizar a ordem." };
      } else {
        const title = read(form, "title");
        const clientId = read(form, "client_id");
        const priority = read(form, "priority");
        const startDate = optional(form, "start_date");
        const dueDate = optional(form, "due_date");
        if (!title || title.length > 220 || !isUuid(clientId) || !Object.hasOwn(priorities, priority)) {
          return { error: "Confira o título, o cliente e a prioridade." };
        }
        if (startDate && dueDate && dueDate < startDate) return { error: "O prazo deve ser igual ou posterior ao início previsto." };

        const fields = {
          title, client_id: clientId, priority, status,
          proposal_id: optional(form, "proposal_id"),
          responsible_user_id: optional(form, "responsible_user_id"),
          description: optional(form, "description"), notes: optional(form, "notes"),
          start_date: startDate, due_date: dueDate, estimated_value: parseAmount(read(form, "estimated_value")),
        };

        if (operation === "create") {
          const { error } = await db.from("service_orders").insert({ ...fields, id, organization_id: organizationId });
          let savedId = id;
          if (error?.code === "23505") {
            const existingRequest = await db.from("service_orders").select("id").eq("organization_id", organizationId)
              .eq("id", id).eq("created_by", userId).maybeSingle();
            const existingProposal = fields.proposal_id && await db.from("service_orders").select("id")
              .eq("organization_id", organizationId).eq("proposal_id", fields.proposal_id).eq("client_id", clientId).maybeSingle();
            const existing = existingRequest.data ?? (existingProposal ? existingProposal.data : null);
            if (!existing) return { error: errors[error.code] };
            savedId = existing.id;
          } else if (error) {
            return { error: errors[error.code] ?? "Falha ao criar a ordem." };
          }
          destination = '/operacoes?ordem=' + savedId;
        } else {
          const { data, error } = await db.from("service_orders").update(fields)
            .eq("organization_id", organizationId).eq("id", id).select("id").maybeSingle();
          if (error || !data) return { error: errors[error?.code ?? "42501"] ?? "Falha ao editar a ordem." };
        }
      }
    } else {
      const orderId = read(form, "order_id");
      if (!isUuid(orderId)) return { error: "Ordem inválida." };
      if (operation === "task-create" || operation === "task-edit") {
        const description = read(form, "description");
        if (!description || description.length > 2000) return { error: "Informe a descrição da tarefa." };
        const fields = { description, responsible_user_id: optional(form, "responsible_user_id"), due_date: optional(form, "due_date") };
        const result = operation === "task-create"
          ? await db.from("service_order_tasks").insert({ ...fields, id, organization_id: organizationId, order_id: orderId }).select("id").maybeSingle()
          : await db.from("service_order_tasks").update(fields).eq("organization_id", organizationId).eq("order_id", orderId).eq("id", id).select("id").maybeSingle();
        if (result.error || !result.data) return { error: errors[result.error?.code ?? "42501"] ?? "Falha ao salvar a tarefa." };
      } else if (operation === "task-toggle" || operation === "task-delete") {
        const write = operation === "task-delete" ? db.from("service_order_tasks").delete()
          : db.from("service_order_tasks").update({ done: read(form, "done") === "true" });
        const { data, error } = await write.eq("organization_id", organizationId).eq("order_id", orderId).eq("id", id)
          .select("id").maybeSingle();
        if (error || !data) return { error: errors[error?.code ?? "42501"] ?? "Falha ao atualizar a tarefa." };
      } else {
        return { error: "Operação inválida." };
      }
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao salvar." };
  }

  revalidatePath("/operacoes");
  revalidatePath("/clientes");
  if (destination) redirect(destination);
  return { success: "Alteração salva." };
}
