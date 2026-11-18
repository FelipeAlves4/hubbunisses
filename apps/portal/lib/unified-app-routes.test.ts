import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("unified application routes", () => {
  it("mounts the existing PRECIFICA+ and PROPOSTA+ experiences under the Hub", () => {
    expect(source("../app/precifica/page.tsx")).toContain(
      'precifica-plus/app/(protected)/page',
    );
    expect(source("../app/proposta/page.tsx")).toContain(
      'proposta-plus/app/(protected)/page',
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
});
