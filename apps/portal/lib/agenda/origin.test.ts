import { describe, expect, it } from "vitest";
import { normalizeAgendaOrigin, signAgendaOrigin } from "./origin";
import { effectiveStatus } from "./model";

describe("public agenda origin proof", () => {
  it("normalizes IPv4 and groups IPv6 privacy addresses within the same /64", () => {
    expect(normalizeAgendaOrigin("::ffff:192.0.2.3")).toBe("192.0.2.3");
    expect(normalizeAgendaOrigin("2001:DB8:0001::5")).toBe(normalizeAgendaOrigin("2001:db8:1:0:fe80::123"));
    expect(normalizeAgendaOrigin("2001:db8:1:2::5")).not.toBe(normalizeAgendaOrigin("2001:db8:1:3::5"));
    expect(normalizeAgendaOrigin("192.0.2.3, 192.0.2.4")).toBeNull();
  });
  it("scopes the proof to the action, slug and server key", () => {
    const signed = (action: "book" | "slots", slug: string, key = "1".repeat(64)) =>
      signAgendaOrigin(key, "192.0.2.3", action, slug, 1_000_000);
    expect(signed("book", "pilot")).toMatchObject({ issued_at: 1000, origin_key: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(signed("book", "pilot")?.proof).not.toBe(signed("slots", "pilot")?.proof);
    expect(signed("book", "pilot")?.proof).not.toBe(signed("book", "other")?.proof);
    expect(signed("book", "pilot", "weak")).toBeNull();
  });
  it("only derives expired status for pending holds at the deadline", () => {
    const expires_at = "2026-12-01T12:00:00Z";
    const deadline = Date.parse(expires_at);
    expect(effectiveStatus({ status: "pending", expires_at }, deadline - 1)).toBe("pending");
    expect(effectiveStatus({ status: "pending", expires_at }, deadline)).toBe("expired");
    expect(effectiveStatus({ status: "confirmed", expires_at }, deadline + 1)).toBe("confirmed");
  });
});
