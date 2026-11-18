import type { Metadata } from "next";
import "@asex/ui/styles.css";
import "./proposta.css";

export const metadata: Metadata = {
  title: "PROPOSTA+",
  description: "Propostas comerciais profissionais",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
