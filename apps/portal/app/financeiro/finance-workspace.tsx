"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  Landmark,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useRef, useState, useTransition } from "react";
import { createCategoryAction, deleteTransactionAction, saveTransactionAction } from "./actions";
import {
  calculateDashboard,
  categoryFitsType,
  filterTransactions,
  formatCurrency,
  isOverdue,
  localIsoDate,
  monthBounds,
  parseCurrencyToCents,
  type FinanceCategory,
  type FinanceCategoryKind,
  type FinanceEntryType,
  type FinanceFilters,
  type FinanceStatus,
  type FinanceTransaction,
} from "./finance";

type FinanceWorkspaceProps = {
  configured: boolean;
  categories: FinanceCategory[];
  transactions: FinanceTransaction[];
};

type TransactionDraft = {
  id?: string;
  categoryId: string;
  entryType: FinanceEntryType;
  description: string;
  amount: string;
  issuedAt: string;
  dueDate: string;
  paidAt: string;
  status: FinanceStatus;
  notes: string;
  clientMutationId: string;
};

const initialBounds = monthBounds();
const initialFilters: FinanceFilters = { ...initialBounds, type: "all", categoryId: "all", status: "all" };

function newDraft(categories: FinanceCategory[]): TransactionDraft {
  const today = localIsoDate();
  return {
    categoryId: categories[0]?.id ?? "",
    entryType: "income",
    description: "",
    amount: "",
    issuedAt: today,
    dueDate: today,
    paidAt: today,
    status: "pending",
    notes: "",
    clientMutationId: crypto.randomUUID(),
  };
}

function draftFromTransaction(transaction: FinanceTransaction): TransactionDraft {
  return {
    id: transaction.id,
    categoryId: transaction.categoryId,
    entryType: transaction.entryType,
    description: transaction.description,
    amount: (transaction.amountCents / 100).toFixed(2).replace(".", ","),
    issuedAt: transaction.issuedAt,
    dueDate: transaction.dueDate,
    paidAt: transaction.paidAt ?? localIsoDate(),
    status: transaction.status,
    notes: transaction.notes ?? "",
    clientMutationId: crypto.randomUUID(),
  };
}

function statusLabel(transaction: FinanceTransaction) {
  if (isOverdue(transaction)) return "Atrasado";
  return transaction.status === "paid" ? "Pago" : "Pendente";
}

export function FinanceWorkspace({ configured, categories, transactions }: FinanceWorkspaceProps) {
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);
  const [draft, setDraft] = useState<TransactionDraft>(() => newDraft(categories));
  const [editing, setEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryKind, setCategoryKind] = useState<FinanceCategoryKind>("both");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [toDelete, setToDelete] = useState<FinanceTransaction | null>(null);
  const [isPending, startTransition] = useTransition();
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const visibleTransactions = useMemo(
    () => filterTransactions(transactions, filters),
    [filters, transactions],
  );
  const dashboard = useMemo(
    () => calculateDashboard(transactions, filters),
    [filters.from, filters.to, transactions],
  );
  const availableCategories = categories.filter((category) => categoryFitsType(category, draft.entryType));

  function openNew() {
    setDraft(newDraft(categories));
    setEditing(false);
    setFormError("");
    setShowForm(true);
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  }

  function openEdit(transaction: FinanceTransaction) {
    setDraft(draftFromTransaction(transaction));
    setEditing(true);
    setFormError("");
    setShowForm(true);
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  }

  function updateDraft<K extends keyof TransactionDraft>(key: K, value: TransactionDraft[K]) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "entryType") {
        const allowed = categories.filter((category) => categoryFitsType(category, value as FinanceEntryType));
        if (!allowed.some((category) => category.id === current.categoryId)) next.categoryId = allowed[0]?.id ?? "";
      }
      return next;
    });
  }

  function handleTransactionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const amountCents = parseCurrencyToCents(draft.amount);
    if (!amountCents) {
      setFormError("Informe um valor maior que zero, por exemplo 1.250,00.");
      return;
    }
    if (!draft.categoryId) {
      setFormError("Crie ou selecione uma categoria para esta movimentação.");
      return;
    }
    startTransition(async () => {
      const result = await saveTransactionAction({
        id: draft.id,
        categoryId: draft.categoryId,
        entryType: draft.entryType,
        description: draft.description,
        amountCents,
        issuedAt: draft.issuedAt,
        dueDate: draft.dueDate,
        paidAt: draft.status === "paid" ? draft.paidAt : null,
        status: draft.status,
        notes: draft.notes || null,
        clientMutationId: draft.clientMutationId,
      });
      if (!result.ok) { setFormError(result.message); return; }
      setNotice(result.message);
      setShowForm(false);
      router.refresh();
    });
  }

  function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createCategoryAction({ name: categoryName, kind: categoryKind });
      if (!result.ok) { setNotice(result.message); return; }
      setCategoryName("");
      setNotice(result.message);
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    startTransition(async () => {
      const result = await deleteTransactionAction(toDelete.id);
      setNotice(result.message);
      if (result.ok) {
        setToDelete(null);
        router.refresh();
      }
    });
  }

  return (
    <main className="finance-shell">
      <header className="finance-header">
        <a className="finance-brand" href="/" aria-label="Voltar ao ASEX Business Hub">
          <span>ASEX</span> <strong>NEXO Finance</strong>
        </a>
        <div className="finance-header-actions">
          <button className="finance-button finance-button-quiet" type="button" onClick={() => setShowCategories(true)}>
            <ReceiptText size={18} /> Categorias
          </button>
          <button className="finance-button finance-button-primary" type="button" onClick={openNew}>
            <Plus size={18} /> Nova movimentação
          </button>
        </div>
      </header>

      <section className="finance-page" aria-labelledby="finance-title">
        <div className="finance-intro">
          <div>
            <p className="finance-kicker">Visão financeira</p>
            <h1 id="finance-title">Decisões guiadas pelo que já aconteceu.</h1>
            <p>O realizado considera somente pagamentos confirmados. Valores pendentes permanecem em previsão.</p>
          </div>
          <div className="finance-period" aria-label="Período do painel">
            <CalendarDays size={18} aria-hidden="true" />
            <label>De<input type="date" value={filters.from} onChange={(event) => setFilters((value) => ({ ...value, from: event.target.value }))} /></label>
            <label>Até<input type="date" value={filters.to} onChange={(event) => setFilters((value) => ({ ...value, to: event.target.value }))} /></label>
          </div>
        </div>

        {!configured ? <p className="finance-setup" role="status">Configure o Supabase e conceda o entitlement NEXO Finance para persistir dados desta organização.</p> : null}
        {notice ? <p className="finance-toast" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Fechar mensagem"><X size={15} /></button></p> : null}

        <section className="finance-metrics" aria-label="Resumo financeiro realizado e previsto">
          <Metric icon={<ArrowUpRight />} label="Receita recebida" value={formatCurrency(dashboard.receivedCents)} note="Pagamentos no período" tone="positive" />
          <Metric icon={<ArrowDownRight />} label="Despesas pagas" value={formatCurrency(dashboard.paidCents)} note="Saídas confirmadas" tone="negative" />
          <Metric icon={<WalletCards />} label="Saldo realizado" value={formatCurrency(dashboard.realizedBalanceCents)} note="Não é saldo bancário" tone="neutral" />
          <Metric icon={<CircleDollarSign />} label="Contas a receber" value={formatCurrency(dashboard.receivableCents)} note="Pendentes por vencimento" tone="forecast" />
          <Metric icon={<Landmark />} label="Contas a pagar" value={formatCurrency(dashboard.payableCents)} note="Pendentes por vencimento" tone="forecast" />
        </section>

        <section className="finance-history" aria-labelledby="history-title">
          <div className="finance-section-heading">
            <div><p className="finance-kicker">Histórico</p><h2 id="history-title">Movimentações</h2></div>
            <span>{visibleTransactions.length} de {transactions.length} registros</span>
          </div>
          <div className="finance-filters">
            <label>Tipo<select value={filters.type} onChange={(event) => setFilters((value) => ({ ...value, type: event.target.value as FinanceFilters["type"] }))}><option value="all">Todos os tipos</option><option value="income">Receitas</option><option value="expense">Despesas</option></select></label>
            <label>Categoria<select value={filters.categoryId} onChange={(event) => setFilters((value) => ({ ...value, categoryId: event.target.value }))}><option value="all">Todas as categorias</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label>Status<select value={filters.status} onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value as FinanceFilters["status"] }))}><option value="all">Todos os status</option><option value="pending">Pendente</option><option value="paid">Pago</option><option value="overdue">Atrasado</option></select></label>
          </div>
          <div className="finance-table-wrap">
            <table>
              <thead><tr><th>Movimentação</th><th>Categoria</th><th>Vencimento</th><th>Status</th><th>Valor</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>{visibleTransactions.length ? visibleTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td><strong>{transaction.description}</strong><small>Lançado em {new Intl.DateTimeFormat("pt-BR").format(new Date(`${transaction.issuedAt}T12:00:00`))}</small></td>
                  <td>{transaction.categoryName}</td>
                  <td>{new Intl.DateTimeFormat("pt-BR").format(new Date(`${transaction.dueDate}T12:00:00`))}</td>
                  <td><span className={`finance-status finance-status-${isOverdue(transaction) ? "overdue" : transaction.status}`}>{statusLabel(transaction)}</span></td>
                  <td className={transaction.entryType === "income" ? "finance-income" : "finance-expense"}>{transaction.entryType === "income" ? "+" : "−"}{formatCurrency(transaction.amountCents)}</td>
                  <td><div className="finance-row-actions"><button type="button" onClick={() => openEdit(transaction)} aria-label={`Editar ${transaction.description}`}><Pencil size={16} /></button><button className="finance-delete" type="button" onClick={() => setToDelete(transaction)} aria-label={`Excluir ${transaction.description}`}><Trash2 size={16} /></button></div></td>
                </tr>
              )) : <tr><td className="finance-empty" colSpan={6}>Nenhuma movimentação corresponde aos filtros. Ajuste o período ou registre a primeira.</td></tr>}</tbody>
            </table>
          </div>
        </section>
      </section>

      {showForm ? <TransactionForm draft={draft} categories={availableCategories} editing={editing} error={formError} pending={isPending} firstFieldRef={firstFieldRef} onClose={() => setShowForm(false)} onChange={updateDraft} onSubmit={handleTransactionSubmit} /> : null}
      {showCategories ? <CategoryDialog categories={categories} name={categoryName} kind={categoryKind} pending={isPending} onClose={() => setShowCategories(false)} onNameChange={setCategoryName} onKindChange={setCategoryKind} onSubmit={handleCategorySubmit} /> : null}
      {toDelete ? <DeleteDialog transaction={toDelete} pending={isPending} onCancel={() => setToDelete(null)} onConfirm={confirmDelete} /> : null}
    </main>
  );
}

function Metric({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string }) {
  return <article className={`finance-metric finance-metric-${tone}`}><span className="finance-metric-icon">{icon}</span><p>{label}</p><strong>{value}</strong><small>{note}</small></article>;
}

function TransactionForm({ draft, categories, editing, error, pending, firstFieldRef, onClose, onChange, onSubmit }: { draft: TransactionDraft; categories: FinanceCategory[]; editing: boolean; error: string; pending: boolean; firstFieldRef: React.RefObject<HTMLInputElement | null>; onClose: () => void; onChange: <K extends keyof TransactionDraft>(key: K, value: TransactionDraft[K]) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="finance-overlay" role="presentation"><section className="finance-dialog finance-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="entry-title"><div className="finance-dialog-head"><div><p className="finance-kicker">{editing ? "Editar registro" : "Novo registro"}</p><h2 id="entry-title">{editing ? "Atualize a movimentação" : "Registre uma movimentação"}</h2></div><button type="button" onClick={onClose} aria-label="Fechar formulário"><X /></button></div><form noValidate onSubmit={onSubmit}><div className="finance-segmented" aria-label="Tipo de movimentação"><button type="button" className={draft.entryType === "income" ? "is-active income" : ""} onClick={() => onChange("entryType", "income")}>Receita</button><button type="button" className={draft.entryType === "expense" ? "is-active expense" : ""} onClick={() => onChange("entryType", "expense")}>Despesa</button></div><div className="finance-form-grid"><label className="finance-field finance-field-wide">Descrição<input ref={firstFieldRef} value={draft.description} onChange={(event) => onChange("description", event.target.value)} maxLength={160} required aria-invalid={Boolean(error)} /></label><label className="finance-field">Valor<input value={draft.amount} onChange={(event) => onChange("amount", event.target.value)} inputMode="decimal" placeholder="0,00" required /></label><label className="finance-field">Categoria<select value={draft.categoryId} onChange={(event) => onChange("categoryId", event.target.value)} required><option value="">Selecione</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="finance-field">Data de lançamento<input type="date" value={draft.issuedAt} onChange={(event) => onChange("issuedAt", event.target.value)} required /></label><label className="finance-field">Vencimento<input type="date" value={draft.dueDate} onChange={(event) => onChange("dueDate", event.target.value)} required /></label><label className="finance-field">Situação<select value={draft.status} onChange={(event) => onChange("status", event.target.value as FinanceStatus)}><option value="pending">Pendente</option><option value="paid">Pago</option></select></label>{draft.status === "paid" ? <label className="finance-field">Pagamento<input type="date" value={draft.paidAt} onChange={(event) => onChange("paidAt", event.target.value)} required /></label> : <p className="finance-realization-note">Esta conta ficará em previsão e não compõe o saldo realizado.</p>}<label className="finance-field finance-field-wide">Observações <span>opcional</span><textarea className="resize-none" value={draft.notes} onChange={(event) => onChange("notes", event.target.value)} maxLength={2000} /></label></div>{error ? <p className="finance-form-error" role="alert">{error}</p> : null}<div className="finance-dialog-actions"><button className="finance-button finance-button-quiet" type="button" disabled={pending} onClick={onClose}>Cancelar</button><button className="finance-button finance-button-primary" type="submit" disabled={pending}>{pending ? "Salvando…" : editing ? "Salvar alterações" : "Salvar movimentação"}</button></div></form></section></div>;
}

function CategoryDialog({ categories, name, kind, pending, onClose, onNameChange, onKindChange, onSubmit }: { categories: FinanceCategory[]; name: string; kind: FinanceCategoryKind; pending: boolean; onClose: () => void; onNameChange: (value: string) => void; onKindChange: (value: FinanceCategoryKind) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="finance-overlay" role="presentation"><section className="finance-dialog finance-category-dialog" role="dialog" aria-modal="true" aria-labelledby="category-title"><div className="finance-dialog-head"><div><p className="finance-kicker">Organização</p><h2 id="category-title">Categorias financeiras</h2></div><button type="button" onClick={onClose} aria-label="Fechar categorias"><X /></button></div><form noValidate onSubmit={onSubmit} className="finance-category-form"><label className="finance-field">Nova categoria<input value={name} onChange={(event) => onNameChange(event.target.value)} maxLength={80} required /></label><label className="finance-field">Aplicação<select value={kind} onChange={(event) => onKindChange(event.target.value as FinanceCategoryKind)}><option value="both">Receitas e despesas</option><option value="income">Apenas receitas</option><option value="expense">Apenas despesas</option></select></label><button className="finance-button finance-button-primary" type="submit" disabled={pending}>{pending ? "Criando…" : "Criar categoria"}</button></form><ul className="finance-category-list">{categories.length ? categories.map((category) => <li key={category.id}><span>{category.name}</span><small>{category.kind === "both" ? "Receitas e despesas" : category.kind === "income" ? "Receitas" : "Despesas"}</small></li>) : <li className="finance-empty">Nenhuma categoria criada.</li>}</ul></section></div>;
}

function DeleteDialog({ transaction, pending, onCancel, onConfirm }: { transaction: FinanceTransaction; pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="finance-overlay" role="presentation"><section className="finance-dialog finance-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description"><p className="finance-kicker">Ação permanente</p><h2 id="delete-title">Excluir movimentação?</h2><p id="delete-description">“{transaction.description}” será removida do histórico e deixará de compor os indicadores.</p><div className="finance-dialog-actions"><button className="finance-button finance-button-quiet" type="button" disabled={pending} onClick={onCancel}>Cancelar</button><button className="finance-button finance-button-danger" type="button" disabled={pending} onClick={onConfirm}>{pending ? "Excluindo…" : "Excluir movimentação"}</button></div></section></div>;
}
