/** Funding source and AI eligibility are separate from the engine's legacy funded flag. */
export function citizenLabels(a: Record<string, unknown>) {
  const ownKey = a.brain === "own_key";
  const external = a.brain === "own_brain";
  const world = !a.owner && !ownKey && !external;
  const subscribed = typeof a.plan === "string" && a.plan !== "none";
  const budget = (a.budget ?? {}) as Record<string, number>;
  const included = (budget.tier1Left ?? 0) > 0 || (budget.tier2Left ?? 0) > 0;
  const credits = typeof a.credits === "number" && a.credits > 0;
  const subscription = world ? "Not applicable" : subscribed
    ? String(a.plan).charAt(0).toUpperCase() + String(a.plan).slice(1)
    : "No subscription";
  const funding = ownKey ? "Personal API key" : external ? "External brain" : world ? "World-funded" : subscribed ? "Subscription" : credits ? "Purchased credits" : a.credits === undefined ? "No subscription · credits unknown" : "No AI funding";
  const ai_access = a.funded === false ? "AI disabled"
    : ownKey ? "Personal key · subject to cap"
    : external ? "External service"
    : included ? "Included allowance available"
    : credits ? "Credits available"
    : a.owner && a.credits === undefined ? "Allowance empty · credits unknown"
    : "Routine only";
  return { funding, subscription, ai_access };
}
