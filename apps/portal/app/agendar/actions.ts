"use server";

import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { instant, isDay, slug, uuid, type Catalog, type Slot } from "../../lib/agenda/model";

function publicClient() {
  if (!isSupabaseConfigured()) return null;
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: { getAll: () => [], setAll: () => {} },
    global: { fetch: (input, options) => fetch(input, { ...options, cache: "no-store" }) },
  });
}

const rateMessage = "Muitas solicitações para esta agenda. Tente novamente em um minuto.";

export async function getPublicCatalog(publicSlug: string): Promise<{ catalog?: Catalog; error?: string }> {
  const db = publicClient();
  if (!db || !slug(publicSlug)) return { error: "Esta agenda não está disponível." };
  const { data, error } = await db.rpc("agenda_public_catalog", { public_slug: publicSlug });
  if (data?.error === "rate_limit") return { error: rateMessage };
  return error || !data ? { error: "Esta agenda não está disponível." } : { catalog: data };
}

export async function publicSlots(publicSlug: string, service: string, professional: string, day: string): Promise<{ slots?: Slot[]; error?: string }> {
  const db = publicClient();
  if (!db || !slug(publicSlug) || !uuid(service) || !uuid(professional) || !isDay(day)) return { error: "Confira a data e as opções selecionadas." };
  const { data, error } = await db.rpc("agenda_public_slots", { public_slug: publicSlug, service, professional, day });
  if (data?.error === "rate_limit") return { error: rateMessage };
  return error || !Array.isArray(data) ? { error: "Não foi possível consultar esta data." } : { slots: data };
}

export async function publicBook(publicSlug: string, service: string, professional: string, start: string,
  guest: string, contact: string, channel: string): Promise<{ reference?: string; status?: "confirmed" | "pending"; error?: string }> {
  const db = publicClient();
  if (!db || !slug(publicSlug) || !uuid(service) || !uuid(professional) || !instant(start) ||
    typeof guest !== "string" || typeof contact !== "string" || guest.length < 2 || guest.length > 120 || contact.length > 254 ||
    !["email", "phone"].includes(channel)) return { error: "Confira o horário e os dados de contato." };
  const { data, error } = await db.rpc("agenda_public_book", { public_slug: publicSlug, service, professional, start_at: start, guest, contact, channel });
  if (data?.error === "rate_limit") return { error: rateMessage };
  if (data?.error === "invalid_contact") return { error: "Informe um contato válido para este tipo de reserva." };
  if (data?.error === "unavailable") return { error: "Este horário não está mais disponível. Volte para escolher outro." };
  return error || !data?.reference ? { error: "Não foi possível registrar a reserva." } : data;
}
