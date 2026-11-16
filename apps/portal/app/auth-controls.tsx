"use client";

import { LogOut, Settings2 } from "lucide-react";
import { createClient } from "../lib/supabase/browser";

export function AuthControls({ initials }: { initials: string }) {
  async function signOut() {
    await createClient().auth.signOut();
    window.location.assign("/login");
  }

  return (
    <nav className="hub-account" aria-label="Conta e configurações">
      <span className="profile-avatar" aria-label="Perfil">
        {initials}
      </span>
      <a
        className="settings-link"
        href="#configuracoes"
        aria-label="Configurações"
      >
        <Settings2 size={21} strokeWidth={1.9} />
      </a>
      <button
        className="signout-button"
        type="button"
        onClick={signOut}
        aria-label="Sair"
      >
        <LogOut size={18} />
      </button>
    </nav>
  );
}
