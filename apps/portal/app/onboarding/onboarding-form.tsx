"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Building2 } from "lucide-react";
import { createClient } from "../../lib/supabase/browser";

export function OnboardingForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const fields = new FormData(event.currentTarget);
    const name = String(fields.get("name") ?? "").trim();
    if (name.length < 2 || name.length > 160) {
      setBusy(false);
      setMessage("Informe um nome de empresa entre 2 e 160 caracteres.");
      return;
    }
    const { error } = await createClient().rpc("create_organization", {
      organization_name: name,
      organization_segment: String(fields.get("segment") ?? "") || null,
      organization_phone: String(fields.get("phone") ?? "") || null,
      organization_logo_url: String(fields.get("logoUrl") ?? "") || null,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    window.location.assign("/");
  }
  return (
    <main className="auth-shell">
      <section
        className="auth-card onboarding-card"
        aria-labelledby="onboarding-title"
      >
        <a className="auth-brand" href="/">
          ASEX <span>Business Hub</span>
        </a>
        <p className="eyebrow">Configuração inicial</p>
        <h1 id="onboarding-title">Vamos configurar sua empresa.</h1>
        <p className="auth-copy">
          Você será o proprietário da organização e poderá convidar a equipe
          posteriormente.
        </p>
        <form noValidate onSubmit={submit} className="auth-form">
          <label>
            <span>Nome da empresa</span>
            <div>
              <Building2 size={17} />
              <input name="name" minLength={2} maxLength={160} required />
            </div>
          </label>
          <label>
            <span>
              Segmento de atuação <em>opcional</em>
            </span>
            <div>
              <input name="segment" maxLength={120} />
            </div>
          </label>
          <label>
            <span>
              Telefone <em>opcional</em>
            </span>
            <div>
              <input name="phone" type="tel" maxLength={40} />
            </div>
          </label>
          <label>
            <span>
              URL do logotipo <em>opcional</em>
            </span>
            <div>
              <input name="logoUrl" type="url" placeholder="https://…" />
            </div>
          </label>
          {message ? (
            <p className="auth-message" role="alert">
              {message}
            </p>
          ) : null}
          <button className="auth-submit" disabled={busy}>
            {busy ? "Criando…" : "Criar organização"}
            <ArrowRight size={17} />
          </button>
        </form>
      </section>
    </main>
  );
}
