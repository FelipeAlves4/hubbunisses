import { requireApplicationAccess } from "../../lib/application-access";
import "../../../precifica-plus/app/precifica.css";

export default async function PrecificaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireApplicationAccess("precifica-plus", "/precifica");
  return children;
}
