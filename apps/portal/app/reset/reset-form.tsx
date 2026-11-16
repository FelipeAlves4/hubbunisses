"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { createClient } from "../../lib/supabase/browser";

type ClaimsResult = { data: { claims?: { sub?: string } } | null };

export function ResetForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void createClient()
      .auth.getClaims()
      .then((result: ClaimsResult) => {
        if (!result.data?.claims?.sub)
          setMessage("O link de recuperação expirou. Solicite um novo link.");
      });
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(
      new FormData(event.currentTarget).get("password") ?? "",
    );
    if (password.length < 8) {
      setMessage("A nova senha deve conter pelo menos 8 caracteres.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    window.location.assign("/");
  }
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="reset-title">
        <a className="auth-brand" href="/">
          ASEX <span>Business Hub</span>
        </a>
        <p className="eyebrow">Recuperação de acesso</p>
        <h1 id="reset-title">Defina uma nova senha</h1>
        <p className="auth-copy">
          Escolha uma senha forte com pelo menos oito caracteres.
        </p>
        <form noValidate onSubmit={submit} className="auth-form">
          <label>
            <span>Nova senha</span>
            <div>
              <KeyRound size={17} />
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          </label>
          {message ? (
            <p className="auth-message" role="status">
              {message}
            </p>
          ) : null}
          <button className="auth-submit" disabled={busy}>
            {busy ? "Atualizando…" : "Atualizar senha"}
            <ArrowRight size={17} />
          </button>
        </form>
      </section>
    </main>
  );
}
