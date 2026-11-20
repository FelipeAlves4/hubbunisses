"use client";

import { Button, StatusMessage } from "@asex/ui";
import { startTransition, useActionState, useState, type ReactNode } from "react";
import { mutateOperation } from "./actions";
import { orderNumber, priorities, statuses, type Option, type Order, type Proposal, type Task } from "./model";

export function OperationForm({ operation, id, orderId, children, label }: {
  operation: string; id: string; orderId?: string; children?: ReactNode; label: string;
}) {
  const [result, action, pending] = useActionState(mutateOperation, {});
  return <form className="opera-form" action={action} onSubmit={(event) => {
    event.preventDefault();
    const payload = new FormData(event.currentTarget);
    startTransition(() => action(payload));
  }}>
    <input type="hidden" name="operation" value={operation} />
    <input type="hidden" name="id" value={id} />
    {orderId && <input type="hidden" name="order_id" value={orderId} />}
    <fieldset disabled={pending}>
      {children}
      <Button type="submit">{pending ? "Salvando…" : label}</Button>
    </fieldset>
    {result.error && <p className="opera-error" role="alert">{result.error}</p>}
    {result.success && <StatusMessage>{result.success}</StatusMessage>}
  </form>;
}

export function MemberField({ members, value }: { members: Option[]; value?: string | null }) {
  return <label>Responsável<select name="responsible_user_id" defaultValue={value ?? ""}>
    <option value="">Sem responsável</option>
    {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
  </select></label>;
}

export function OrderForm({ id, order, proposal, clients, members, proposals }: {
  id: string; order?: Order; proposal?: Proposal; clients: Option[]; members: Option[]; proposals: Proposal[];
}) {
  const [clientId, setClientId] = useState(order?.client_id ?? proposal?.client_id ?? "");
  const [proposalId, setProposalId] = useState(order?.proposal_id ?? proposal?.id ?? "");
  const eligible = proposals.filter((item) => item.client_id === clientId);
  return <OperationForm operation={order ? "edit" : "create"} id={id} label={order ? "Salvar ordem" : "Confirmar criação"}>
    <div className="opera-fields">
      <label className="opera-wide">Título<input name="title" required maxLength={220} defaultValue={order?.title ?? proposal?.title} /></label>
      <label>Cliente<select name="client_id" required value={clientId} disabled={Boolean(proposal)} onChange={(event) => {
        setClientId(event.target.value);
        setProposalId("");
      }}>
        <option value="">Selecione um cliente</option>
        {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
      </select></label>
      {proposal && <input type="hidden" name="client_id" value={proposal.client_id} />}
      <label>Proposta<select name="proposal_id" value={proposalId} disabled={Boolean(proposal)} onChange={(event) => setProposalId(event.target.value)}>
        <option value="">Sem proposta</option>
        {eligible.map((item) => <option key={item.id} value={item.id}>PR-{String(item.number).padStart(4, "0")} · {item.title}</option>)}
        {order?.proposal_id === proposalId && proposalId && !eligible.some((item) => item.id === proposalId) &&
          <option value={proposalId}>Proposta vinculada anteriormente</option>}
      </select></label>
      {proposal && <input type="hidden" name="proposal_id" value={proposal.id} />}
      <MemberField members={members} value={order?.responsible_user_id} />
      <label>Prioridade<select name="priority" defaultValue={order?.priority ?? "medium"}>
        {Object.entries(priorities).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <label>Status<select name="status" defaultValue={order?.status ?? "pending"}>
        {Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <label>Valor previsto (R$)<input name="estimated_value" inputMode="decimal" placeholder="0,00" defaultValue={order?.estimated_value ?? proposal?.amount ?? ""} /></label>
      <label>Início previsto<input name="start_date" type="date" defaultValue={order?.start_date ?? ""} /></label>
      <label>Prazo previsto<input name="due_date" type="date" defaultValue={order?.due_date ?? ""} /></label>
      <label className="opera-wide">Descrição<textarea name="description" rows={3} maxLength={8000} defaultValue={order?.description ?? ""} /></label>
      <label className="opera-wide">Observações<textarea name="notes" rows={3} maxLength={8000} defaultValue={order?.notes ?? ""} /></label>
    </div>
  </OperationForm>;
}

export function StatusForm({ order }: { order: Order }) {
  return <OperationForm operation="status" id={order.id} label="Mover ordem">
    <label>Etapa de {orderNumber(order.number)}<select name="status" defaultValue={order.status}>
      {Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
  </OperationForm>;
}

export function TaskForm({ id, orderId, members, task }: { id: string; orderId: string; members: Option[]; task?: Task }) {
  return <OperationForm operation={task ? "task-edit" : "task-create"} id={id} orderId={orderId} label={task ? "Salvar tarefa" : "Adicionar tarefa"}>
    <div className="opera-fields">
      <label className="opera-wide">Descrição<input name="description" required maxLength={2000} defaultValue={task?.description} /></label>
      <MemberField members={members} value={task?.responsible_user_id} />
      <label>Prazo<input name="due_date" type="date" defaultValue={task?.due_date ?? ""} /></label>
    </div>
  </OperationForm>;
}
