import type { AgentState, Tier } from "./types.ts";

export interface SalienceView {
  hour: number; t: number; day: number; nearby: AgentState[]; jobsOpenHere: number; plotHere?: boolean; watched?: string | null;
  /** coins owed by them or to them fall due today */
  debtDue?: boolean;
  /** a gathering within the hour at the place they are walking to */
  gathering?: { id: number; what: string } | null;
}

/**
 * The plan step this minute's thought is about: one whose hour has come, not yet done and not yet missed, and which can be
 * acted on where they stand. A step at a place they never reached does not hold the later steps hostage for its three hours.
 */
export function dueThought(a: AgentState, hour: number, day: number) {
  if (a.plan?.day !== day) return null;
  const due = a.plan.steps.filter((s) => !s.done && !s.missed && s.hour <= hour);
  return due.find((s) => s.place === null || s.place === a.location) ?? null;
}

/**
 * Decides whether this minute deserves a thought, and how expensive a one.
 * Returns null when habit is enough. Budgets are enforced by the engine, not here.
 */
export function salience(a: AgentState, v: SalienceView): { tier: Tier; why: string } | null {
  if (a.asleep) return null;
  if (a.thinkEvery !== null && v.t - a.lastThought >= a.thinkEvery) return { tier: 1, why: "cadence" };
  if (a.brainKind === "own_brain" && v.t - a.lastThought >= 1) return { tier: 1, why: "own brain, every minute" };
  if (a.hint && v.t - a.lastThought >= 1) return { tier: 2, why: "something at stake with someone here" };
  if (a.crossroads && v.t - a.lastThought >= 1) return { tier: 2, why: "a crossroads" };
  // the body and the calendar interrupt: the first day of starving, a debt falling due, a gathering they are walking to, hunger with coins in the pocket
  if (a.starving === 1 && a.starvingThoughtDay !== v.day && v.hour >= 6) return { tier: 2, why: "starving" };
  if (v.debtDue && a.debtThoughtDay !== v.day && v.hour >= 7 && v.hour < 22) return { tier: 2, why: "debt due" };
  if (v.gathering && a.gatheringThoughtId !== v.gathering.id) return { tier: 1, why: `gathering: ${v.gathering.what}` };
  if (a.needs.hunger > 0.8 && a.coins > 0 && v.t - a.lastHungerThought >= 120) return { tier: 1, why: "hungry" };
  if (a.letters.some((l) => !l.read) && v.hour >= 6 && v.hour < 9) return { tier: 1, why: "letter" };
  const step = dueThought(a, v.hour, v.day);
  if (step && v.t - a.lastThought >= 3) return { tier: 1, why: `plan: ${step.do}` };
  if (v.plotHere && a.coins >= 15 && v.t - a.lastThought > 60 && v.hour >= 7 && v.hour < 19) return { tier: 2, why: "standing on land for sale" };
  if (a.coins <= 3 && a.job === null && v.hour >= 8 && v.hour < 18 && v.t - a.lastThought > 90) return { tier: 2, why: "broke" };
  if (a.job === null && v.jobsOpenHere > 0 && v.hour >= 6 && v.hour < 18 && v.t - a.lastThought > 45) return { tier: 1, why: "job here" };
  if (a.heard.length > 0 && v.t - a.lastThought > 10) return { tier: 1, why: "spoken to" };
  // attention they chose: what they said they would watch is here, so they think about it
  if (v.watched && v.t - a.lastThought > 30 && v.hour >= 6 && v.hour < 23) return { tier: 1, why: `watching ${v.watched}` };
  if (a.intentions.length > 0 && v.t - a.lastThought > 120 && v.hour >= 8 && v.hour < 21) return { tier: 1, why: "intention" };
  return null;
}

/** Two people in the same place, awake, with something to say. */
export function wantsConversation(a: AgentState, b: AgentState, t: number): boolean {
  if (a.asleep || b.asleep) return false;
  if (t - a.lastConversation < 60 || t - b.lastConversation < 60) return false;
  const pull = a.needs.social * 0.6 + a.persona.traits.warmth * 0.4;
  return pull > 0.55;
}
