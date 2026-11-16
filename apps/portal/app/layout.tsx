import type { Metadata } from "next";
import "@asex/ui/styles.css";
import "./portal.css";
export const metadata: Metadata = { title: "ASEX Business", description: "Portal de ferramentas empresariais" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html>; }
