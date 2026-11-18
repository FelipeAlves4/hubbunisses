import { getApplicationAccess } from "../../lib/application-access";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { createClient } from "../../lib/supabase/server";
import type { FinanceCategory, FinanceTransaction } from "./finance";

export type FinanceData = {
  configured: boolean;
  categories: FinanceCategory[];
  transactions: FinanceTransaction[];
};

export async function getFinanceData(): Promise<FinanceData> {
  if (!isSupabaseConfigured()) {
    return { configured: false, categories: [], transactions: [] };
  }
  const { organizationId } = await getApplicationAccess("nexo-finance");
  const supabase = await createClient();
  const [{ data: categories, error: categoryError }, { data: transactions, error: transactionError }] = await Promise.all([
    supabase
      .from("finance_categories")
      .select("id, name, kind")
      .eq("organization_id", organizationId)
      .order("name")
      .limit(100),
    supabase
      .from("finance_transactions")
      .select("id, category_id, entry_type, description, amount_cents, issued_at, due_date, paid_at, status, notes, finance_categories(name)")
      .eq("organization_id", organizationId)
      .order("issued_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (categoryError || transactionError) {
    throw new Error(categoryError?.message ?? transactionError?.message ?? "Não foi possível carregar o financeiro.");
  }
  return {
    configured: true,
    categories: (categories ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      kind: category.kind,
    })),
    transactions: (transactions ?? []).map((transaction) => ({
      id: transaction.id,
      categoryId: transaction.category_id,
      categoryName: ((transaction.finance_categories as { name?: string } | null)?.name ?? "Categoria removida"),
      entryType: transaction.entry_type,
      description: transaction.description,
      amountCents: Number(transaction.amount_cents),
      issuedAt: transaction.issued_at,
      dueDate: transaction.due_date,
      paidAt: transaction.paid_at,
      status: transaction.status,
      notes: transaction.notes,
    })),
  };
}
