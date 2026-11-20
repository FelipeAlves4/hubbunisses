import Link from "next/link";

const applicationNames = {
  "precifica-plus": "PRECIFICA+",
  "proposta-plus": "PROPOSTA+",
  "opera-plus": "OPERA+",
  "nexo-finance": "NEXO Finance",
} as const;

export default async function AccessDeniedPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ app?: string }> }>) {
  const { app } = await searchParams;
  const name =
    app && app in applicationNames
      ? applicationNames[app as keyof typeof applicationNames]
      : "esta ferramenta";

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="access-denied-title">
        <p className="eyebrow">Acesso restrito</p>
        <h1 id="access-denied-title">Sua organização ainda não possui acesso a {name}.</h1>
        <p className="auth-copy">
          Se acredita que isso é um engano, solicite a liberação ao responsável
          pela sua conta empresarial.
        </p>
        <Link className="auth-submit" href="/">
          Voltar ao Hub
        </Link>
      </section>
    </main>
  );
}
