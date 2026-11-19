export type CRMStage = "new_lead" | "contact_started" | "qualification" | "proposal_sent" | "negotiation" | "won" | "lost";

export function getCRMIndicators(opportunities: Array<{ stage: CRMStage; estimated_value_cents: number }>, followUps: Array<{ due_date: string | null; completed_at: string | null }>, today: string) {
  const open = opportunities.filter((opportunity) => opportunity.stage !== "won" && opportunity.stage !== "lost");
  return {
    totalOpen: open.length,
    estimatedPipelineCents: open.reduce((total, opportunity) => total + opportunity.estimated_value_cents, 0),
    won: opportunities.filter((opportunity) => opportunity.stage === "won").length,
    lost: opportunities.filter((opportunity) => opportunity.stage === "lost").length,
    overdueFollowUps: followUps.filter((activity) => !activity.completed_at && activity.due_date !== null && activity.due_date < today).length,
  };
}
