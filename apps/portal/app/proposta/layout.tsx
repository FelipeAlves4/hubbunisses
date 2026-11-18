import { requireApplicationAccess } from "../../lib/application-access";
import "../../../proposta-plus/app/proposta.css";

export default async function PropostaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireApplicationAccess("proposta-plus", "/proposta");
  return children;
}
