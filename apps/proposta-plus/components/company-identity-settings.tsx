"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { LoaderCircle, LockKeyhole, Save, ShieldCheck } from "lucide-react";
import { TemplatePicker } from "./proposal-document-preview";
import type {
  OrganizationDocumentFallback,
  ProposalTemplate,
} from "../lib/proposal-document";
import { createClient } from "../lib/supabase/browser";

type IdentitySettings = {
  tradeName: string;
  email: string;
  address: string;
  accentColor: string;
  defaultTemplate: ProposalTemplate;
};

const defaults: IdentitySettings = {
  tradeName: "",
  email: "",
  address: "",
  accentColor: "#2563eb",
  defaultTemplate: "executive",
};

export function CompanyIdentitySettings({
  organizationId,
  fallback,
  canManage,
  onIdentitySaved,
  onDefaultTemplateSaved,
  onNotice,
  onError,
}: {
  organizationId: string;
  fallback: OrganizationDocumentFallback;
  canManage: boolean;
  onIdentitySaved: (identity: OrganizationDocumentFallback) => void;
  onDefaultTemplateSaved: (template: ProposalTemplate) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [settings, setSettings] = useState<IdentitySettings>(defaults);
  const [phone, setPhone] = useState(fallback.phone ?? "");
  const [logoUrl, setLogoUrl] = useState(fallback.logoUrl ?? "");
  const [settingsReady, setSettingsReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPhone(fallback.phone ?? "");
    setLogoUrl(fallback.logoUrl ?? "");
  }, [fallback.logoUrl, fallback.phone]);

  useEffect(() => {
    let active = true;
    async function loadSettings() {
      setLoading(true);
      const { data, error } = await createClient()
        .from("organization_proposal_document_settings")
        .select("trade_name, email, address, accent_color, default_template")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        // The settings table is intentionally unavailable until the separately
        // reviewed migration has been approved and applied.
        setSettingsReady(false);
      } else {
        setSettingsReady(true);
        if (data) {
          setSettings({
            tradeName: data.trade_name ?? "",
            email: data.email ?? "",
            address: data.address ?? "",
            accentColor: data.accent_color ?? defaults.accentColor,
            defaultTemplate:
              (data.default_template as ProposalTemplate) ?? defaults.defaultTemplate,
          });
          onDefaultTemplateSaved(
            (data.default_template as ProposalTemplate) ?? defaults.defaultTemplate,
          );
        }
      }
      setLoading(false);
    }
    void loadSettings();
    return () => {
      active = false;
    };
  }, [organizationId]);

  async function save() {
    if (!canManage) return;
    setSaving(true);
    const identity = {
      name: fallback.name,
      phone: phone.trim() || null,
      logoUrl: logoUrl.trim() || null,
    };
    const { error: organizationError } = await createClient()
      .from("organizations")
      .update({ phone: identity.phone, logo_url: identity.logoUrl })
      .eq("id", organizationId);
    if (organizationError) {
      setSaving(false);
      onError(organizationError.message);
      return;
    }
    if (settingsReady) {
      const { error: settingsError } = await createClient()
        .from("organization_proposal_document_settings")
        .upsert(
          {
            organization_id: organizationId,
            trade_name: settings.tradeName.trim() || null,
            email: settings.email.trim() || null,
            address: settings.address.trim() || null,
            accent_color: settings.accentColor,
            default_template: settings.defaultTemplate,
          },
          { onConflict: "organization_id" },
        );
      if (settingsError) {
        setSaving(false);
        onError(settingsError.message);
        return;
      }
      onDefaultTemplateSaved(settings.defaultTemplate);
      onNotice("Identidade empresarial atualizada para as próximas propostas.");
    } else {
      onNotice("Telefone e logotipo atualizados. Os demais dados aguardam a migration de identidade.");
    }
    onIdentitySaved(identity);
    setSaving(false);
  }

  const businessName = settings.tradeName.trim() || fallback.name;
  return (
    <section className="page identity-page">
      <header className="page-title">
        <div>
          <span className="paper-eyebrow">Marca e documentos</span>
          <h1>Identidade empresarial</h1>
          <p>Defina a apresentação usada exclusivamente nas próximas propostas.</p>
        </div>
        {canManage ? (
          <button className="primary" type="button" onClick={() => void save()} disabled={saving || loading}>
            {saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}
            Salvar identidade
          </button>
        ) : (
          <span className="identity-access"><LockKeyhole size={16} /> Somente proprietários podem alterar</span>
        )}
      </header>

      {!settingsReady && !loading ? <p className="identity-migration-note">Os campos comerciais abaixo serão persistidos após a aprovação da migration de identidade; nenhum dado histórico será alterado.</p> : null}
      <div className="identity-layout">
        <div className="identity-form form-panel">
          <div className="section-line"><div><h2>Dados da empresa</h2><p>Logotipo e telefone reutilizam o cadastro organizacional atual.</p></div><ShieldCheck size={20} /></div>
          <div className="field-grid">
            <label>Telefone<input value={phone} disabled={!canManage} onChange={(event) => setPhone(event.target.value)} placeholder="(11) 99999-9999" /></label>
            <label className="identity-full-field">URL do logotipo<input type="url" value={logoUrl} disabled={!canManage} onChange={(event) => setLogoUrl(event.target.value)} placeholder="https://..." /></label>
          </div>
          <label>Nome comercial<input value={settings.tradeName} disabled={!canManage || !settingsReady} onChange={(event) => setSettings((current) => ({ ...current, tradeName: event.target.value }))} placeholder={fallback.name} /></label>
          <div className="field-grid">
            <label>E-mail<input type="email" value={settings.email} disabled={!canManage || !settingsReady} onChange={(event) => setSettings((current) => ({ ...current, email: event.target.value }))} placeholder="comercial@empresa.com" /></label>
            <label>Cor de destaque<input className="identity-color" type="color" value={settings.accentColor} disabled={!canManage || !settingsReady} onChange={(event) => setSettings((current) => ({ ...current, accentColor: event.target.value.toUpperCase() }))} /></label>
          </div>
          <label>Endereço <span className="optional-label">opcional</span><textarea value={settings.address} disabled={!canManage || !settingsReady} onChange={(event) => setSettings((current) => ({ ...current, address: event.target.value }))} placeholder="Rua, número, cidade e CEP" /></label>
          <div className="identity-template"><span>Template padrão para novas propostas</span><TemplatePicker value={settings.defaultTemplate} onChange={(template) => setSettings((current) => ({ ...current, defaultTemplate: template }))} /></div>
        </div>
        <aside className="identity-preview" style={{ "--identity-accent": settings.accentColor } as CSSProperties}>
          <span className="paper-eyebrow">Prévia da identidade</span>
          <div className="identity-preview-header">
            {logoUrl ? <img src={logoUrl} alt="Prévia do logotipo" /> : <span>{businessName.slice(0, 2).toUpperCase()}</span>}
            <div><strong>{businessName}</strong><small>{[phone || null, settings.email || null].filter(Boolean).join(" · ") || "Dados de contato"}</small></div>
          </div>
          <div className="identity-preview-rule" />
          <p>PROPOSTA COMERCIAL</p><b>PR-0001</b>
          <small>{settings.address || "Endereço opcional da empresa"}</small>
        </aside>
      </div>
    </section>
  );
}
