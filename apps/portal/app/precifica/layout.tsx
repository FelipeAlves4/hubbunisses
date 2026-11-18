import { requireApplicationAccess } from "../../lib/application-access";

export default async function PrecificaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireApplicationAccess("precifica-plus", "/precifica");
  return children;
}
