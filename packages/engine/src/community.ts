import type { AgentState, Place } from "./types.ts";
import { GARDEN } from "./world.ts";

/** A chosen membership, not a goal assigned by the simulation. */
export function joinedProject(a: AgentState, p: Place): boolean {
  return !!p.community?.members.some(m => m.id === a.id && m.help);
}
export function gardenReady(p: Place, day: number, hour: number, weather?: string, season?: string): boolean {
  return p.community?.phase === "complete" && day >= (p.community.completedDay ?? day) + GARDEN.growDays
    && hour >= 6 && hour < 20 && weather !== "storm" && season !== "winter"
    && !(p.brokenUntil && p.brokenUntil > day) && (p.stock.vegetables ?? 0) < GARDEN.capacity;
}
