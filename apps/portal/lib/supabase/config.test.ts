import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applicationUrls, supabaseCookieOptions } from "./config";

const originalDomain = process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN;
const applicationVariables = ["NEXT_PUBLIC_ASEX_PORTAL_URL"] as const;
const originalApplicationVariables = Object.fromEntries(
  applicationVariables.map((name) => [name, process.env[name]]),
);

afterEach(() => {
  if (originalDomain === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN = originalDomain;
  }
  for (const name of applicationVariables) {
    const value = originalApplicationVariables[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("supabaseCookieOptions", () => {
  it("does not share Supabase cookies through Vercel default domains", () => {
    process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN = ".vercel.app";

    expect(supabaseCookieOptions()).not.toHaveProperty("domain");
  });

  it("accepts a future verified parent domain", () => {
    process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN = "example.com";

    expect(supabaseCookieOptions()).toMatchObject({
      domain: "example.com",
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    });
  });
});

describe("application navigation", () => {
  it("keeps product navigation on the Hub origin by default", () => {
    for (const name of applicationVariables) delete process.env[name];

    expect(applicationUrls()).toMatchObject({
      portal: "https://asex-business-hub.vercel.app",
      precifica: "https://asex-business-hub.vercel.app/precifica",
      proposta: "https://asex-business-hub.vercel.app/proposta",
    });
  });

  it("derives product paths from the configured Hub origin", () => {
    process.env.NEXT_PUBLIC_ASEX_PORTAL_URL = "https://hub.example.test";

    expect(applicationUrls().precifica).toBe("https://hub.example.test/precifica");
  });

  it("renders the active card as an internal link without a click handler", () => {
    const page = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
    const card = page.match(
      /<Link\s+className="application-card application-card-active"[\s\S]*?<\/Link>/,
    )?.[0];

    expect(card).toContain('href={`/${application.urlKey}`}');
    expect(card).not.toContain("onClick");
  });

  it("keeps the card overlay transparent to pointer events", () => {
    const css = readFileSync(new URL("../../app/portal.css", import.meta.url), "utf8");
    const baseRule = css.match(/\.application-card-active\s*\{([^}]*)\}/)?.[1];
    const overlayRule = css.match(/\.application-card-active::after\s*\{([^}]*)\}/)?.[1];

    expect(baseRule).not.toMatch(/pointer-events\s*:\s*none/);
    expect(overlayRule).toMatch(/pointer-events\s*:\s*none/);
  });
});
