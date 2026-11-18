import type { Metadata } from "next";
import { FinanceWorkspace } from "./finance-workspace";
import { getFinanceData } from "./data";

export const metadata: Metadata = {
  title: "NEXO Finance | ASEX Business",
  description: "Gestão financeira da sua organização.",
};

export default async function FinancePage() {
  const data = await getFinanceData();
  return <FinanceWorkspace {...data} />;
}
