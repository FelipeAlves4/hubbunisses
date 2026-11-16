export type CompanyProfile = {
  legalName: string;
  tradeName?: string;
  logoDataUrl?: string;
  phone?: string;
  email?: string;
  accentColor?: string;
};
export class CompanyProfileError extends Error {}
const COMPANY_KEY = "asex.precifica.company.v1";
const MAX_LOGO_BYTES = 1024 * 1024;
const SAFE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function isProfile(value: unknown): value is CompanyProfile {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const profile = value as Record<string, unknown>;
  return (
    [
      "legalName",
      "tradeName",
      "logoDataUrl",
      "phone",
      "email",
      "accentColor",
    ].every(
      (key) => profile[key] === undefined || typeof profile[key] === "string",
    ) &&
    (!profile.logoDataUrl ||
      /^(data:image\/(png|jpeg|webp);base64,)/.test(
        String(profile.logoDataUrl),
      ))
  );
}

export const companyProfileRepository = {
  async get(): Promise<CompanyProfile> {
    try {
      const raw = window.localStorage.getItem(COMPANY_KEY);
      if (!raw) return { legalName: "" };
      const parsed: unknown = JSON.parse(raw);
      if (!isProfile(parsed)) throw new Error();
      return parsed;
    } catch {
      throw new CompanyProfileError(
        "Não foi possível carregar os dados de relatórios. Os dados existentes não foram alterados.",
      );
    }
  },
  async save(profile: CompanyProfile) {
    if (!isProfile(profile))
      throw new CompanyProfileError(
        "Revise os dados para relatórios antes de salvar.",
      );
    try {
      window.localStorage.setItem(COMPANY_KEY, JSON.stringify(profile));
    } catch {
      throw new CompanyProfileError(
        "Não foi possível salvar os dados de relatórios neste navegador.",
      );
    }
  },
  async logoFromFile(file: File): Promise<string> {
    if (!SAFE_IMAGE_TYPES.has(file.type))
      throw new CompanyProfileError(
        "Use um logotipo PNG, JPG ou WebP. SVG não é aceito por segurança.",
      );
    if (file.size > MAX_LOGO_BYTES)
      throw new CompanyProfileError("O logotipo deve ter no máximo 1 MB.");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () =>
        reject(new CompanyProfileError("Não foi possível ler o logotipo."));
      reader.onload = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new CompanyProfileError("Não foi possível ler o logotipo."));
      reader.readAsDataURL(file);
    });
  },
};
