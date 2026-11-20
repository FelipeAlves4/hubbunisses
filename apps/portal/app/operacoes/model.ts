export const statuses = {
  pending: "Pendente",
  planned: "Planejado",
  in_progress: "Em andamento",
  waiting: "Aguardando",
  completed: "Concluído",
  cancelled: "Cancelado",
} as const;

export const priorities = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
} as const;

export type Status = keyof typeof statuses;
export type Priority = keyof typeof priorities;
export type Order = {
  id: string;
  number: number;
  title: string;
  description: string | null;
  client_id: string;
  proposal_id: string | null;
  responsible_user_id: string | null;
  priority: Priority;
  status: Status;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  estimated_value: string | number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
};

export type Task = {
  id: string;
  description: string;
  responsible_user_id: string | null;
  due_date: string | null;
  done: boolean;
  completed_at: string | null;
};

export type Option = { id: string; name: string };
export type Proposal = { id: string; number: number; title: string; client_id: string; amount: string };
export const isUuid = (value: string) => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export const orderNumber = (number: number) => 'OS-' + String(number).padStart(5, '0');
export const isOpen = (order: Pick<Order, "status">) => order.status !== "completed" && order.status !== "cancelled";
export const isLate = (order: Pick<Order, "status" | "due_date">, today: string) =>
  isOpen(order) && order.due_date !== null && order.due_date < today;
export const progress = (tasks: Pick<Task, "done">[]) =>
  tasks.length ? Math.round(tasks.filter((task) => task.done).length * 100 / tasks.length) : 0;

export function parseAmount(value: string) {
  if (!value) return null;
  if (!/^\d{1,12}(?:[.,]\d{1,2})?$/.test(value)) throw new Error("Informe um valor previsto válido, com até dois decimais.");
  return value.replace(",", ".");
}
