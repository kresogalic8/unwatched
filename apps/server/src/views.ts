import { bagView, equipped, capacity, syncItems, type Town, type AgentState, type Place } from "@unwatched/engine";
import type { TownEvent } from "@unwatched/protocol";

/** What anyone may see about a person: what the town knows. */
/** Whether an owner's plan carries the portrait and the voice: set by the server once billing is up. House citizens have both. */
let perksOf: (a: AgentState) => boolean = () => true;
export function setPerks(fn: (a: AgentState) => boolean): void { perksOf = fn; }
export function publicAgent(town: Town, a: AgentState) {
  syncItems(a, town.t);
  const tool = equipped(a);
  const job = a.job ? town.jobs.get(a.job)?.title ?? a.job : null;
  return {
    sharedKnowledge: (a.foodAdvice ?? []).map(x => ({ from: x.from, name: town.agents.get(x.from)?.persona.name ?? x.from, place: town.places.get(x.place)?.name ?? x.place, item: x.item, confidence: x.confidence, sourceT: x.sourceT, sharedT: x.sharedT, eventId: x.eventId })),
    observedPurchases: (a.foodLessons ?? []).flatMap(l => {
      const receipts=l.evidence.filter(e=>e.success && e.eventId !== undefined);
      return receipts.length ? [{ place: town.places.get(l.place)?.name ?? l.place, item: l.item, receipts: receipts.map(e=>({t:e.t,eventId:e.eventId!,cost:e.cost})) }] : [];
    }),
    id: a.id, name: a.persona.name, age: a.persona.age, origin: a.persona.origin, summary: a.persona.summary,
    location: a.location, place: town.places.get(a.location)?.name ?? a.location, asleep: a.asleep,
    job, home: a.home?.place ?? null, arrivedDay: Math.floor(a.arrivedAt / 1440) + 1, funded: a.funded,
    gear: tool ? {name: tool.name, condition: tool.condition} : null,
    packCount: a.inventory.length, packCapacity: capacity(a),
    ownerId: a.owner, appearance: a.appearance ?? null, carrying: a.inventory.length ? a.inventory[a.inventory.length - 1]! : null,
    pose: poseOf(town, a), weak: a.starving >= 2, daysHungry: a.starving, perks: perksOf(a),
    activity: a.activity && a.activity.place === a.location && a.activity.until > town.t && !a.asleep ? a.activity : null,
    // what shows on a person in the street: the patches of the broke, the waistcoat of someone with a roof of their own
    broke: a.coins <= 2, roof: !!a.home && town.places.get(a.home.place)?.owner === a.id, roofless: !a.home,
  };
}

/** What the owner sees: everything the agent knows. */
export function ownerAgent(town: Town, a: AgentState) {
  return {
    ...publicAgent(town, a),
    belongings: bagView(a, town.t),
    desires: a.desires ?? [],
    foodAdvice: a.foodAdvice ?? [],
    foodLessons: a.foodLessons ?? [], foodRoutineDecisions: a.foodRoutineDecisions ?? [],
    persona: a.persona,
    needs: a.needs, coins: a.coins, inventory: a.inventory,
    nightsPaid: a.home?.nightsPaid ?? 0,
    budget: a.budget, intentions: a.intentions, plan: a.plan && a.plan.day === town.day && a.plan.goals.length ? { mood: a.plan.mood, goals: a.plan.goals, steps: a.plan.steps } : null,
    people: [...a.relationships.entries()].map(([id, r]) => ({ id, name: town.agents.get(id)?.persona.name ?? id, trust: r.trust, affection: r.affection, opinion: r.opinion, lastSeen: r.lastSeen, tide: tideWord(r.trust, r.affection) })),
    memories: a.memory.slice(-60).reverse(),
    letters: a.letters,
    instructions: a.instructions,
    brainKind: a.brainKind,
    watch: a.watch, selves: a.selves, doToday: a.doToday, projects: a.projects, beliefs: a.beliefs,
  };
}

export function tideWord(trust: number, _affection: number): string {
  if (trust < 0.2) return "gone"; if (trust < 0.3) return "ebbing"; if (trust < 0.45) return "steady"; if (trust < 0.65) return "rising"; return "close";
}

export function serializeEvent(e: TownEvent) { return e; }

/** What the real world adds to the clock, when the island keeps our time. The server sets it. */
export const realClock: { place?: string; temperatureC?: number | null; sunrise?: string | null; sunset?: string | null } = {};
export function clockOf(town: Town) {
  return { t: town.t, day: town.day, minute: town.minuteOfDay, hour: town.hour, label: town.clock(), weather: town.weather, season: town.season, population: town.agents.size, flourShortage: town.flourShortage, weekday: town.weekdayName, occasion: town.occasion, month: town.month, inSeason: town.inSeason(), voices: !!(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY), ...(realClock.place ? { place: realClock.place, temperatureC: realClock.temperatureC ?? null, sunrise: realClock.sunrise ?? null, sunset: realClock.sunset ?? null } : {}) };
}

/** What the body is doing this minute, for the world to draw: asleep, at work, on a site, at ease somewhere, or standing. */
export function poseOf(town: Town, a: AgentState): "sleep" | "work" | "sit" | "idle" {
  if (a.asleep) return "sleep";
  const here = town.places.get(a.location);
  if (a.activity?.kind === "work" && a.activity.place === a.location && a.activity.until > town.t) return "work";
  if (here && (here.kind === "inn" || here.kind === "public") && town.hour >= 17) return "sit";
  return "idle";
}

/** Only voluntary public contributions and work; no private intentions or memories. */
export function publicProject(town: Town, p: Place) {
  if (!p.community) return undefined;
  return { ...structuredClone(p.community), byName: town.agents.get(p.community.by)?.persona.name ?? p.community.by,
    members: p.community.members.map(m => ({ ...m, name: town.agents.get(m.id)?.persona.name ?? m.id })) };
}
