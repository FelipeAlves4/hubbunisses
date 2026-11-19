export type ClientType = "individual" | "company";

export type ClientInput = {
  id?: string;
  name: string;
  type: ClientType;
  contactName?: string;
  email?: string;
  phone?: string;
  documentNumber?: string;
  address?: string;
  notes?: string;
};

function text(value: string | undefined, max: number, field: string, min = 0) {
  const result = value?.trim().replace(/\s+/g, " ") || "";
  if (result && (result.length < min || result.length > max)) throw new Error(`${field} deve ter entre ${min} e ${max} caracteres.`);
  return result || null;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function isValidCpf(value: string) {
  if (value.length !== 11 || /^(\d)\1+$/.test(value)) return false;
  const digit = (length: number) => {
    const total = value
      .slice(0, length)
      .split("")
      .reduce((sum, current, index) => sum + Number(current) * (length + 1 - index), 0);
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
}

function isValidCnpj(value: string) {
  if (value.length !== 14 || /^(\d)\1+$/.test(value)) return false;
  const digit = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const total = value
      .slice(0, length)
      .split("")
      .reduce((sum, current, index) => sum + Number(current) * weights[index], 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return digit(12) === Number(value[12]) && digit(13) === Number(value[13]);
}

export function formatDocumentNumber(value: string, type: ClientType) {
  const digits = onlyDigits(value).slice(0, type === "individual" ? 11 : 14);
  if (type === "individual") {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3}\.\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2}\.\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/, "$1/$2")
    .replace(/^(\d{2}\.\d{3}\.\d{3}\/\d{4})(\d)/, "$1-$2");
}

export function normalizeDocumentNumber(value: string | undefined, type: ClientType) {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  const digits = onlyDigits(raw);
  const label = type === "individual" ? "CPF" : "CNPJ";
  const valid = type === "individual" ? isValidCpf(digits) : isValidCnpj(digits);
  if (!valid) throw new Error(`${label} inválido.`);
  return formatDocumentNumber(digits, type);
}

export function toClientValues(input: ClientInput) {
  const name = text(input.name, 180, "Nome", 2);
  if (!name) throw new Error("Nome deve ter entre 2 e 180 caracteres.");
  const email = text(input.email, 254, "E-mail");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Informe um e-mail válido.");
  return {
    name,
    type: input.type,
    contact_name: text(input.contactName, 160, "Contato", 2),
    email,
    phone: text(input.phone, 40, "Telefone"),
    document_number: normalizeDocumentNumber(input.documentNumber, input.type),
    address: text(input.address, 1200, "Endereço"),
    notes: text(input.notes, 4000, "Observações"),
  };
}
