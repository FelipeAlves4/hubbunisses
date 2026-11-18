import { LockKeyhole } from "lucide-react";
import { portalUrl } from "../../lib/supabase/config";

export default function AccessDeniedPage() {
  return (
    <main className="access-shell">
      <section className="access-card" aria-labelledby="access-title">
        <LockKeyhole size={28} aria-hidden="true" />
        <p className="auth-kicker">Acesso não autorizado</p>
        <h1 id="access-title">Sua organização não possui acesso ao PROPOSTA+.</h1>
        <p>Solicite a liberação ao responsável pela sua organização ou volte ao Hub para consultar as ferramentas disponíveis.</p>
        <a className="access-link" href={portalUrl}>Voltar ao ASEX Business Hub</a>
      </section>
    </main>
  );
}
