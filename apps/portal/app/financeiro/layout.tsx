import { requireApplicationAccess } from "../../lib/application-access";
import "./financeiro.css";

export default async function FinanceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireApplicationAccess("nexo-finance", "/financeiro");
  return children;
}
