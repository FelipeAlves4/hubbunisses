import { requireApplicationAccess } from "../../lib/application-access";

export default async function PropostaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireApplicationAccess("proposta-plus", "/proposta");
  return children;
}
