"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { createClient } from "../lib/supabase/browser";

export function LocalAuthControls() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    setError("");
    const { error: signOutError } = await createClient().auth.signOut({
      scope: "local",
    });
    if (signOutError) {
      setError("Não foi possível encerrar esta sessão. Tente novamente.");
      setBusy(false);
      return;
    }
    window.location.assign("/login?reason=signed-out");
  }

  return (
    <div className="local-auth-controls">
      <button type="button" onClick={signOut} disabled={busy}>
        <LogOut size={16} /> {busy ? "Saindo…" : "Sair deste aplicativo"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
