import type { Metadata } from "next";
import "@asex/ui/styles.css";
import "./precifica.css";

export const metadata: Metadata = {
  title: "PRECIFICA+",
  description: "Simulador de precificação empresarial",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
