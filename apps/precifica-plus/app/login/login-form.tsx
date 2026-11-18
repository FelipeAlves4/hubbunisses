"use client";

import { ArrowRight, Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { createClient } from "../../lib/supabase/browser";
import { portalUrl } from "../../lib/supabase/config";

type LoginFormProps = { next: string; reason?: string };

function initialMessage(reason?: string) {
  if (reason === "session-expired") return "Sua sessão expirou. Entre novamente para continuar.";
  if (reason === "signed-out") return "Sessão deste aplicativo encerrada.";
  return "";
}

export function LoginForm({ next, reason }: LoginFormProps) {
  const [message, setMessage] = useState(() => initialMessage(reason));
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMessage("Informe um e-mail válido.");
      return;
    }
    if (!password) {
      setMessage("Informe sua senha.");
      return;
    }

    setBusy(true);
    setMessage("");
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(
        error.message.toLowerCase().includes("invalid")
          ? "E-mail ou senha inválidos."
          : "Não foi possível entrar agora. Revise sua conexão e tente novamente.",
      );
      setBusy(false);
      return;
    }
    window.location.assign(next);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <a className="auth-brand" href="/">PRECIFICA<span>+</span></a>
        <p className="auth-kicker">Acesso à sua ferramenta</p>
        <h1 id="login-title">Entre para precificar com segurança.</h1>
        <p className="auth-copy">Use o mesmo e-mail e senha da sua conta ASEX Business.</p>
        <form noValidate className="auth-form" onSubmit={submit}>
          <label htmlFor="login-email">E-mail</label>
          <div className="auth-input">
            <Mail size={18} aria-hidden="true" />
            <input id="login-email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(message)} />
          </div>
          <label htmlFor="login-password">Senha</label>
          <div className="auth-input password-input">
            <KeyRound size={18} aria-hidden="true" />
            <input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required aria-invalid={Boolean(message)} />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {message ? <p className="auth-message" role="alert">{message}</p> : null}
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? "Entrando…" : "Entrar no PRECIFICA+"} <ArrowRight size={18} />
          </button>
        </form>
        <a className="auth-hub-link" href={portalUrl}>Voltar ao ASEX Business Hub</a>
      </section>
    </main>
  );
}
