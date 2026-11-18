import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("unified application routes", () => {
  it("mounts the existing PRECIFICA+ and PROPOSTA+ experiences under the Hub", () => {
    expect(source("../app/precifica/page.tsx")).toContain(
      '<PrecificaPage hubHref="/" />',
    );
    expect(source("../app/proposta/page.tsx")).toContain(
      '<PropostaPage hubHref="/" />',
    );
  });

  it("returns to the Hub through an internal client-side route", () => {
    expect(source("../../precifica-plus/app/(protected)/page.tsx")).toContain(
      'import Link from "next/link"',
    );
    expect(source("../../precifica-plus/app/(protected)/page.tsx")).toContain(
      'href={hubHref}',
    );
    expect(source("../../proposta-plus/app/(protected)/page.tsx")).toContain(
      'import Link from "next/link"',
    );
    expect(source("../../proposta-plus/app/(protected)/page.tsx")).toContain(
      'href={hubHref}',
    );
  });

  it("keeps entitlement checks on the server for each mounted product", () => {
    expect(source("../app/precifica/layout.tsx")).toContain(
      'requireApplicationAccess("precifica-plus", "/precifica")',
    );
    expect(source("../app/proposta/layout.tsx")).toContain(
      'requireApplicationAccess("proposta-plus", "/proposta")',
    );
    const guard = source("./application-access.ts");
    expect(guard).toContain('.from("app_entitlements")');
    expect(guard).toContain('redirect(`/login?next=${encodeURIComponent(returnPath)}`)');
    expect(guard).toContain('redirect(`/access-denied?app=${appKey}`)');
  });

  it("loads product CSS only in its route layout, never in the Portal root", () => {
    const rootLayout = source("../app/layout.tsx");
    expect(rootLayout).not.toContain("precifica-plus/app/precifica.css");
    expect(rootLayout).not.toContain("proposta-plus/app/proposta.css");
    expect(source("../app/precifica/layout.tsx")).toContain(
      'import "../../../precifica-plus/app/precifica.css"',
    );
    expect(source("../app/proposta/layout.tsx")).toContain(
      'import "../../../proposta-plus/app/proposta.css"',
    );
  });
});
