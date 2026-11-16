import {
  ArrowUpRight,
  Calculator,
  ChartNoAxesCombined,
  FileText,
  Settings2,
} from "lucide-react";
import { redirect } from "next/navigation";
import { AuthControls } from "./auth-controls";
import { applicationUrls, isSupabaseConfigured } from "../lib/supabase/config";
import { createClient } from "../lib/supabase/server";

const applications = [
  {
    name: "PRECIFICA+",
    description: "Calcule preços, analise custos e proteja suas margens.",
    icon: Calculator,
    state: "available",
  },
  {
    name: "PROPOSTA+",
    description: "Crie orçamentos profissionais e valorize suas propostas.",
    icon: FileText,
    state: "building",
  },
  {
    name: "NEXO Finance",
    description: "Organize suas finanças e acompanhe seus resultados.",
    icon: ChartNoAxesCombined,
    state: "building",
  },
] as const;

type PortalIdentity = { organizationName?: string; initials?: string };

async function getIdentity(): Promise<PortalIdentity> {
  if (!isSupabaseConfigured()) return {};
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");
  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("organization_id, organizations(name)")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle(),
  ]);
  if (!membership) redirect("/onboarding");
  const organization = membership.organizations as { name?: string } | null;
  const name = profile?.full_name ?? "";
  return {
    organizationName: organization?.name ?? "Sua organização",
    initials:
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part: string) => part[0])
        .join("")
        .toUpperCase() || "AB",
  };
}

export default async function PortalPage() {
  const identity = await getIdentity();
  const urls = applicationUrls();
  const configured = isSupabaseConfigured();
  return (
    <main className="hub-shell" id="inicio">
      <header className="hub-header">
        <a
          className="hub-brand"
          href="#inicio"
          aria-label="ASEX Business Hub, início"
        >
          <strong>ASEX</strong>
          <span>Business Hub</span>
        </a>
        {configured ? (
          <div className="authenticated-account">
            <span className="organization-name">
              {identity.organizationName}
            </span>
            <span className="header-divider" aria-hidden="true" />
            <AuthControls initials={identity.initials ?? "AB"} />
          </div>
        ) : (
          <nav className="hub-account" aria-label="Conta e configurações">
            <a className="organization-name" href="#organizacao">
              Sua organização
            </a>
            <span className="header-divider" aria-hidden="true" />
            <a
              className="profile-avatar"
              href="#perfil"
              aria-label="Abrir perfil"
            >
              AB
            </a>
            <a
              className="settings-link"
              href="#configuracoes"
              aria-label="Configurações"
            >
              <Settings2 size={21} strokeWidth={1.9} />
            </a>
          </nav>
        )}
      </header>
      <section className="hub-content" aria-labelledby="hub-title">
        {!configured ? (
          <p className="setup-notice">
            Modo local: adicione a URL e a chave publicável do Supabase para
            ativar cadastro, organizações e sincronização.
          </p>
        ) : null}
        <div className="hub-intro">
          <h1 id="hub-title">Seu negócio. Suas ferramentas. Um só lugar.</h1>
          <p>Escolha a ferramenta ideal para impulsionar sua gestão.</p>
        </div>
        <div
          className="application-grid"
          aria-label="Aplicativos ASEX Business Hub"
        >
          {applications.map((application) => {
            const Icon = application.icon;
            const content = (
              <>
                <span className="app-icon">
                  <Icon size={38} strokeWidth={1.65} />
                </span>
                <div className="app-main">
                  <h2>{application.name}</h2>
                  <p>{application.description}</p>
                </div>
                {application.state === "available" ? (
                  <span className="card-action">
                    Abrir ferramenta <ArrowUpRight size={19} />
                  </span>
                ) : (
                  <span className="building-state">Em desenvolvimento</span>
                )}
              </>
            );
            return application.state === "available" ? (
              <a
                className="application-card application-card-active"
                href={urls.precifica}
                key={application.name}
              >
                {content}
              </a>
            ) : (
              <article
                className="application-card application-card-building"
                key={application.name}
              >
                {content}
              </article>
            );
          })}
        </div>
      </section>
      <footer className="hub-footer">
        <span>ASEX Business Hub</span>
        <span>Ferramentas para decisões mais claras.</span>
      </footer>
    </main>
  );
}
