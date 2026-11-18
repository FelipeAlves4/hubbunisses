"use server";

import { revalidatePath } from "next/cache";
import { ApplicationAccessError, getApplicationAccess } from "../../lib/application-access";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { createClient } from "../../lib/supabase/server";
import { isIsoDate, type FinanceCategoryKind, type FinanceEntryType, type FinanceStatus } from "./finance";

type ActionResult = { ok: true; message: string } | { ok: false; message: string };
type CategoryInput = { name: string; kind: FinanceCategoryKind };
type TransactionInput = {
  id?: string;
  categoryId: string;
  entryType: FinanceEntryType;
  description: string;
  amountCents: number;
  issuedAt: string;
  dueDate: string;
  paidAt: string | null;
  status: FinanceStatus;
  notes: string | null;
  clientMutationId?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(error: unknown): ActionResult {
  if (error instanceof ApplicationAccessError) return { ok: false, message: "Sua sessão não tem acesso ao NEXO Finance." };
  if (error instanceof Error) return { ok: false, message: error.message };
  return { ok: false, message: "Não foi possível salvar. Tente novamente." };
}

function validateCategory(input: CategoryInput) {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) throw new Error("A categoria deve ter entre 2 e 80 caracteres.");
  if (!(["income", "expense", "both"] as const).includes(input.kind)) throw new Error("Tipo de categoria inválido.");
  return { name, kind: input.kind };
}

function validateTransaction(input: TransactionInput) {
  const description = input.description.trim().replace(/\s+/g, " ");
  if (description.length < 2 || description.length > 160) throw new Error("A descrição deve ter entre 2 e 160 caracteres.");
  if (!UUID.test(input.categoryId)) throw new Error("Selecione uma categoria válida.");
  if (!(["income", "expense"] as const).includes(input.entryType)) throw new Error("Tipo de movimentação inválido.");
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 1 || input.amountCents > 99_999_999_999_999) throw new Error("Informe um valor válido.");
  if (!isIsoDate(input.issuedAt) || !isIsoDate(input.dueDate)) throw new Error("Informe datas válidas.");
  if (!(["pending", "paid"] as const).includes(input.status)) throw new Error("Status inválido.");
  if (input.status === "paid" && !isIsoDate(input.paidAt)) throw new Error("Informe a data de pagamento.");
  if (input.status === "pending" && input.paidAt !== null) throw new Error("Uma conta pendente não pode ter data de pagamento.");
  if (input.notes && input.notes.trim().length > 2000) throw new Error("As observações podem ter no máximo 2.000 caracteres.");
  if (input.id && !UUID.test(input.id)) throw new Error("Movimentação inválida.");
  if (input.clientMutationId && !UUID.test(input.clientMutationId)) throw new Error("Solicitação inválida.");
  return { ...input, description, notes: input.notes?.trim() || null };
}

async function checkCategory(categoryId: string, organizationId: string, entryType: FinanceEntryType) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_categories")
    .select("id, kind")
    .eq("id", categoryId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data || (data.kind !== "both" && data.kind !== entryType)) {
    throw new Error("A categoria não está disponível para este tipo de movimentação.");
  }
}

export async function createCategoryAction(input: CategoryInput): Promise<ActionResult> {
  try {
    if (!isSupabaseConfigured()) throw new Error("Configure o Supabase para salvar categorias.");
    const category = validateCategory(input);
    const { organizationId, userId } = await getApplicationAccess("nexo-finance");
    const supabase = await createClient();
    const { error } = await supabase.from("finance_categories").insert({
      organization_id: organizationId,
      created_by: userId,
      ...category,
    });
    if (error) throw new Error(error.code === "23505" ? "Esta categoria já existe." : error.message);
    revalidatePath("/financeiro");
    return { ok: true, message: "Categoria criada." };
  } catch (error) { return failure(error); }
}

export async function saveTransactionAction(input: TransactionInput): Promise<ActionResult> {
  try {
    if (!isSupabaseConfigured()) throw new Error("Configure o Supabase para salvar movimentações.");
    const transaction = validateTransaction(input);
    const { organizationId, userId } = await getApplicationAccess("nexo-finance");
    await checkCategory(transaction.categoryId, organizationId, transaction.entryType);
    const supabase = await createClient();
    const payload = {
      category_id: transaction.categoryId,
      entry_type: transaction.entryType,
      description: transaction.description,
      amount_cents: transaction.amountCents,
      issued_at: transaction.issuedAt,
      due_date: transaction.dueDate,
      paid_at: transaction.status === "paid" ? transaction.paidAt : null,
      status: transaction.status,
      notes: transaction.notes,
    };
    if (transaction.id) {
      const { data, error } = await supabase
        .from("finance_transactions")
        .update(payload)
        .eq("id", transaction.id)
        .eq("organization_id", organizationId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("A movimentação não existe mais ou você não pode alterá-la.");
      revalidatePath("/financeiro");
      return { ok: true, message: "Movimentação atualizada." };
    }
    const { error } = await supabase.from("finance_transactions").insert({
      ...payload,
      organization_id: organizationId,
      created_by: userId,
      client_mutation_id: transaction.clientMutationId,
    });
    if (error && error.code !== "23505") throw new Error(error.message);
    revalidatePath("/financeiro");
    return { ok: true, message: error ? "Movimentação já havia sido salva." : "Movimentação salva." };
  } catch (error) { return failure(error); }
}

export async function deleteTransactionAction(id: string): Promise<ActionResult> {
  try {
    if (!UUID.test(id)) throw new Error("Movimentação inválida.");
    const { organizationId } = await getApplicationAccess("nexo-finance");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("finance_transactions")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("A movimentação não existe mais ou você não pode excluí-la.");
    revalidatePath("/financeiro");
    return { ok: true, message: "Movimentação excluída." };
  } catch (error) { return failure(error); }
}
