import type { ReactNode } from "react";
import { requireApplicationAccess } from "../../lib/application-access";
import "./agenda.css";

export default async function AgendaLayout({ children }: { children: ReactNode }) {
  await requireApplicationAccess("agenda-plus", "/agenda");
  return children;
}
