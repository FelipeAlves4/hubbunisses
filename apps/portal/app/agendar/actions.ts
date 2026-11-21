"use server";

import { headers } from "next/headers";
import { normalizeAgendaOrigin, signAgendaOrigin, type PublicAgendaAction } from "../../lib/agenda/origin";
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

async function requestProof(action: PublicAgendaAction, publicSlug: string) {
  const key = process.env.AGENDA_ORIGIN_SECRET;
  if (!key) return null;
  // Vercel supplies this header at its trusted edge. Never fall back to
  // caller-controlled X-Forwarded-For or accept an origin as an action input.
  const origin = process.env.VERCEL === "1"
    ? normalizeAgendaOrigin((await headers()).get("x-vercel-forwarded-for") ?? "")
    : process.env.NODE_ENV === "development" ? "local-development" : null;
  return origin ? signAgendaOrigin(key, origin, action, publicSlug) : null;
}

const rateMessage = "Muitas solicitações para esta agenda. Tente novamente em um minuto.";

export async function getPublicCatalog(publicSlug: string): Promise<{ catalog?: Catalog; error?: string }> {
  const db = publicClient();
  if (!db || !slug(publicSlug)) return { error: "Esta agenda não está disponível." };
  const proof = await requestProof("catalog", publicSlug);
  if (!proof) return { error: "Esta agenda pública não está disponível." };
  const { data, error } = await db.rpc("agenda_public_catalog", { ...proof, public_slug: publicSlug });
  if (data?.error === "rate_limit") return { error: rateMessage };
  return error || !data ? { error: "Esta agenda não está disponível." } : { catalog: data };
}

export async function publicSlots(publicSlug: string, service: string, professional: string, day: string): Promise<{ slots?: Slot[]; error?: string }> {
  const db = publicClient();
  if (!db || !slug(publicSlug) || !uuid(service) || !uuid(professional) || !isDay(day)) return { error: "Confira a data e as opções selecionadas." };
  const proof = await requestProof("slots", publicSlug);
  if (!proof) return { error: "Esta agenda pública não está disponível." };
  const { data, error } = await db.rpc("agenda_public_slots", { ...proof, public_slug: publicSlug, service, professional, day });
  if (data?.error === "rate_limit") return { error: rateMessage };
  return error || !Array.isArray(data) ? { error: "Não foi possível consultar esta data." } : { slots: data };
}

export async function publicBook(publicSlug: string, service: string, professional: string, start: string,
  guest: string, contact: string, channel: string): Promise<{ reference?: string; status?: "confirmed" | "pending"; expires_at?: string | null; error?: string }> {
  const db = publicClient();
  if (!db || !slug(publicSlug) || !uuid(service) || !uuid(professional) || !instant(start) ||
    typeof guest !== "string" || typeof contact !== "string" || guest.length < 2 || guest.length > 120 || contact.length > 254 ||
    !["email", "phone"].includes(channel)) return { error: "Confira o horário e os dados de contato." };
  const proof = await requestProof("book", publicSlug);
  if (!proof) return { error: "Esta agenda pública não está disponível." };
  const { data, error } = await db.rpc("agenda_public_book", { ...proof, public_slug: publicSlug, service, professional, start_at: start, guest, contact, channel });
  if (data?.error === "rate_limit") return { error: rateMessage };
  if (data?.error === "invalid_contact") return { error: "Informe um contato válido para este tipo de reserva." };
  if (data?.error === "unavailable") return { error: "Este horário não está mais disponível. Volte para escolher outro." };
  return error || !data?.reference ? { error: "Não foi possível registrar a reserva." } : data;
}
