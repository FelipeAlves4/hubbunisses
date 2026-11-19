import { createClient } from "../../lib/supabase/server";
import { getApplicationAccess } from "../../lib/application-access";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { CRMWorkspace, type Activity, type Client, type Opportunity, type ProposalLink } from "./workspace";

export default async function ClientesPage() {
  if (!isSupabaseConfigured()) {
    return <main className="clienta-error"><h1>Conecte o Supabase para iniciar</h1><p>O CLIENTA+ usa os mesmos clientes e a sessão única do PROPOSTA+. Configure as variáveis públicas para habilitar dados reais.</p></main>;
  }
  const { organizationId } = await getApplicationAccess("clienta-plus");
  const supabase = await createClient();
  const [clients, opportunities, activities, proposalLinks] = await Promise.all([
    supabase.from("proposal_clients").select("id, name, type, contact_name, email, phone, document_number, address, notes, created_by").eq("organization_id", organizationId).order("name"),
    supabase.from("crm_opportunities").select("id, client_id, title, description, estimated_value_cents, stage, priority, expected_close_date, next_contact_date, created_at, updated_at, created_by, proposal_clients(name)").eq("organization_id", organizationId).order("updated_at", { ascending: false }),
    supabase.from("crm_activities").select("id, opportunity_id, activity_type, body, due_date, completed_at, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("crm_opportunity_proposals").select("opportunity_id, proposals(id, number, title, grand_total, status)").eq("organization_id", organizationId),
  ]);
  const error = clients.error ?? opportunities.error ?? activities.error ?? proposalLinks.error;
  if (error) return <main className="clienta-error"><h1>CLIENTA+ aguardando configuração</h1><p>As migrations revisadas precisam estar aplicadas para carregar dados reais.</p><small>{error.message}</small></main>;
  return <CRMWorkspace clients={(clients.data ?? []) as Client[]} opportunities={(opportunities.data ?? []) as unknown as Opportunity[]} activities={(activities.data ?? []) as Activity[]} proposalLinks={(proposalLinks.data ?? []) as unknown as ProposalLink[]} />;
}
