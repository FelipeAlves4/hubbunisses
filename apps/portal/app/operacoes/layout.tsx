import { requireApplicationAccess } from "../../lib/application-access";
import "./opera.css";

export default async function OperaLayout({ children }: { children: React.ReactNode }) {
  await requireApplicationAccess("opera-plus", "/operacoes");
  return children;
}
