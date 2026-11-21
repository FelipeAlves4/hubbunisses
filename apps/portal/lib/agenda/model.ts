export const labels = {
  pending: "Pendente",
  expired: "Expirado",
  confirmed: "Confirmado",
  in_service: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
} as const;

export type Status = keyof typeof labels;
export const transitions: Record<Status, Status[]> = {
  pending: ["confirmed", "cancelled"],
  expired: [],
  confirmed: ["in_service", "cancelled", "no_show"],
  in_service: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export type Slot = { starts_at: string; ends_at: string };
export type Service = { id: string; name: string; description: string | null; duration_minutes: number; price_cents: number | null; active: boolean };
export type Professional = { id: string; name: string; description: string | null; member_id: string | null; active: boolean };
export type Assignment = { professional_id: string; service_id: string };
export type Client = { id: string; name: string };
export type Appointment = Slot & {
  id: string; client_id: string | null; service_id: string; professional_id: string;
  status: Status; expires_at: string | null; origin: "internal" | "public"; created_by: string | null;
  guest_name: string | null; guest_contact: string | null; notes: string | null;
};

export type View = "dia" | "semana" | "mes";
export type ContactMode = "email" | "phone" | "either";
export type Settings = {
  public_name: string; slug: string; timezone: string; public_enabled: boolean; min_notice_minutes: number;
  max_days: number; cancellation_policy: string | null; show_prices: boolean; auto_confirm: boolean; contact_mode: ContactMode;
};
export type Catalog = {
  name: string; timezone: string; maxDays: number; policy: string | null; contactMode: ContactMode;
  services: { id: string; name: string; description: string | null; duration: number; price: number | null }[];
  professionals: { id: string; name: string; description: string | null; services: string[] }[];
};
export type ActionResult = { ok?: string; error?: string };

export function isDay(value: string) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value) || value.startsWith("0000")) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function addDays(day: string, offset: number) {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function calendarPeriod(day: string, view: View) {
  const date = new Date(day + "T00:00:00Z");
  if (view === "dia") return { start: day, end: addDays(day, 1), previous: addDays(day, -1), next: addDays(day, 1), days: [day] };
  const weekStart = (value: string) => addDays(value, -((new Date(value + "T00:00:00Z").getUTCDay() + 6) % 7));
  const first = day.slice(0, 7) + "-01";
  const month = (delta: number) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1)).toISOString().slice(0, 10);
  const start = weekStart(view === "semana" ? day : first);
  const end = view === "semana" ? addDays(start, 7) : addDays(weekStart(addDays(month(1), -1)), 7);
  const days: string[] = [];
  for (let cursor = start; cursor < end; cursor = addDays(cursor, 1)) days.push(cursor);
  return { start, end, days, previous: view === "semana" ? addDays(day, -7) : month(-1), next: view === "semana" ? addDays(day, 7) : month(1) };
}
export function localDay(instant: string | Date, timezone: string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant));
}
export function localTime(instant: string, timezone: string, offset = false) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit", ...(offset && { timeZoneName: "shortOffset" }) }).format(new Date(instant));
}
export function displayDay(day: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(new Date(day + "T00:00:00Z"));
}
export function price(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
export const uuid = (value: string) => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export const slug = (value: string) => typeof value === "string" && /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(value);
export const instant = (value: string) => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,6})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));

// Resolve a civil time by checking the offsets on both sides of a possible
// DST transition. Reject gaps and folds rather than choosing an instant silently.
export function unambiguousInstant(value: string, timezone: string) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value) || !isDay(value.slice(0, 10))) return null;
  const utc = Date.parse(value + "Z");
  if (!Number.isFinite(utc)) return null;
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const offsets = new Set([-36, 0, 36].map((hours) => {
    const sample = utc + hours * 3_600_000;
    return Date.parse(formatter.format(new Date(sample)).replace(" ", "T") + "Z") - sample;
  }));
  const matches = [...offsets].map((offset) => new Date(utc - offset))
    .filter((date) => Number.isFinite(date.getTime()) && formatter.format(date).replace(" ", "T") === value);
  return matches.length === 1 ? matches[0].toISOString() : null;
}

export function effectiveStatus(item: Pick<Appointment, "status" | "expires_at">, now: number): Status {
  return item.status === "pending" && item.expires_at && Date.parse(item.expires_at) <= now ? "expired" : item.status;
}
