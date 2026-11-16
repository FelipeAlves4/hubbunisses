import { ArrowUpRight, Calculator, ChartNoAxesCombined, FileText, Settings2 } from "lucide-react";

const applications = [
  { name: "PRECIFICA+", description: "Calcule preços, analise custos e proteja suas margens.", href: "http://localhost:3001", icon: Calculator, state: "available" },
  { name: "PROPOSTA+", description: "Crie orçamentos profissionais e valorize suas propostas.", icon: FileText, state: "building" },
  { name: "NEXO Finance", description: "Organize suas finanças e acompanhe seus resultados.", icon: ChartNoAxesCombined, state: "building" }
] as const;

export default function PortalPage() {
  return <main className="hub-shell" id="inicio">
    <header className="hub-header">
      <a className="hub-brand" href="#inicio" aria-label="ASEX Business Hub, início"><strong>ASEX</strong><span>Business Hub</span></a>
      <nav className="hub-account" aria-label="Conta e configurações"><a className="organization-name" href="#organizacao">Sua organização</a><span className="header-divider" aria-hidden="true" /><a className="profile-avatar" href="#perfil" aria-label="Abrir perfil">AB</a><a className="settings-link" href="#configuracoes" aria-label="Configurações"><Settings2 size={21} strokeWidth={1.9} /></a></nav>
    </header>
    <section className="hub-content" aria-labelledby="hub-title">
      <div className="hub-intro"><h1 id="hub-title">Seu negócio. Suas ferramentas. Um só lugar.</h1><p>Escolha a ferramenta ideal para impulsionar sua gestão.</p></div>
      <div className="application-grid" aria-label="Aplicativos ASEX Business Hub">
        {applications.map((application) => {
          const Icon = application.icon;
          const content = <><span className="app-icon"><Icon size={38} strokeWidth={1.65} /></span><div className="app-main"><h2>{application.name}</h2><p>{application.description}</p></div>{application.state === "available" ? <span className="card-action">Abrir ferramenta <ArrowUpRight size={19} /></span> : <span className="building-state">Em desenvolvimento</span>}</>;
          return application.state === "available" ? <a className="application-card application-card-active" href={application.href} key={application.name}>{content}</a> : <article className="application-card application-card-building" key={application.name}>{content}</article>;
        })}
      </div>
    </section>
    <footer className="hub-footer"><span>ASEX Business Hub</span><span>Ferramentas para decisões mais claras.</span></footer>
  </main>;
}
