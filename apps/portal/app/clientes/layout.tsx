import { requireApplicationAccess } from "../../lib/application-access";
import "./clienta.css";

export default async function ClientesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireApplicationAccess("clienta-plus", "/clientes");
  return children;
}
