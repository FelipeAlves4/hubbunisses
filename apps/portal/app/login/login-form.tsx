"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { createClient } from "../../lib/supabase/browser";

type Mode = "login" | "signup" | "reset";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMessage("Informe um e-mail válido.");
      setBusy(false);
      return;
    }
    if (mode !== "reset" && password.length < 8) {
      setMessage("A senha deve conter pelo menos 8 caracteres.");
      setBusy(false);
      return;
    }
    const supabase = createClient();
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/confirm?next=/reset`,
        });
        if (error) throw error;
        setMessage("Enviamos as instruções de recuperação para seu e-mail.");
        return;
      }
      if (mode === "signup") {
        const { data: result, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
          },
        });
        if (error) throw error;
        if (!result.session) {
          setMessage("Cadastro criado. Confirme seu e-mail para continuar.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      window.location.assign("/");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a solicitação.",
      );
    } finally {
      setBusy(false);
    }
  }

  const isReset = mode === "reset";
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <a className="auth-brand" href="/">
          ASEX <span>Business Hub</span>
        </a>
        <p className="eyebrow">Acesso seguro</p>
        <h1 id="auth-title">
          {isReset
            ? "Recupere sua senha"
            : mode === "signup"
              ? "Crie sua conta"
              : "Entre na sua conta"}
        </h1>
        <p className="auth-copy">
          {isReset
            ? "Enviaremos um link seguro para redefinir sua senha."
            : "Use suas credenciais ASEX Business para continuar."}
        </p>
        <form noValidate onSubmit={submit} className="auth-form">
          <label>
            <span>E-mail</span>
            <div>
              <Mail size={17} />
              <input name="email" type="email" autoComplete="email" required />
            </div>
          </label>
          {!isReset ? (
            <label>
              <span>Senha</span>
              <div>
                <KeyRound size={17} />
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  minLength={8}
                  required
                />
              </div>
            </label>
          ) : null}
          {message ? (
            <p className="auth-message" role="status">
              {message}
            </p>
          ) : null}
          <button className="auth-submit" disabled={busy}>
            {busy
              ? "Aguarde…"
              : isReset
                ? "Enviar instruções"
                : mode === "signup"
                  ? "Criar conta"
                  : "Entrar"}{" "}
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="auth-links">
          {mode !== "login" ? (
            <button type="button" onClick={() => setMode("login")}>
              Já tenho uma conta
            </button>
          ) : (
            <button type="button" onClick={() => setMode("signup")}>
              Criar conta
            </button>
          )}
          {!isReset ? (
            <button type="button" onClick={() => setMode("reset")}>
              Esqueci minha senha
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
