import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("PROPOSTA+ local authentication flow", () => {
  it("sends unauthenticated protected requests to its own login with an internal return path", () => {
    const proxy = read("../proxy.ts");

    expect(proxy).toContain('request.nextUrl.pathname === "/login"');
    expect(proxy).toContain('new URL("/login", request.url)');
    expect(proxy).toContain('`${request.nextUrl.pathname}${request.nextUrl.search}`');
  });

  it("keeps entitlement enforcement on the server and renders a dedicated denied route", () => {
    const layout = read("../app/(protected)/layout.tsx");

    expect(layout).toContain('.eq("app_key", "proposta-plus")');
    expect(layout).toContain('redirect("/access-denied")');
  });

  it("uses password login and ends only the local application session", () => {
    const loginForm = read("../app/login/login-form.tsx");
    const controls = read("../app/local-auth-controls.tsx");

    expect(loginForm).toContain("signInWithPassword");
    expect(loginForm).not.toContain("signUp(");
    expect(controls).toContain('scope: "local"');
  });
});
