import { describe, expect, it } from "vitest";
import { getCRMIndicators } from "./crm";

describe("getCRMIndicators", () => {
  it("keeps estimated pipeline distinct from won revenue and finds only pending overdue follow-ups", () => {
    expect(getCRMIndicators([
      { stage: "new_lead", estimated_value_cents: 120_00 },
      { stage: "negotiation", estimated_value_cents: 80_00 },
      { stage: "won", estimated_value_cents: 90_00 },
      { stage: "lost", estimated_value_cents: 50_00 },
    ], [
      { due_date: "2026-11-18", completed_at: null },
      { due_date: "2026-11-18", completed_at: "2026-11-18T12:00:00Z" },
      { due_date: "2026-11-19", completed_at: null },
    ], "2026-11-19")).toEqual({ totalOpen: 2, estimatedPipelineCents: 200_00, won: 1, lost: 1, overdueFollowUps: 1 });
  });
});
