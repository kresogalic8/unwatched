import type { Action } from "@unwatched/protocol";
import type { AgentState, Place, Job } from "./types.ts";
import { FOOD_ITEMS } from "./world.ts";

export interface HabitView {
  places: Map<string, Place>;
  jobs: Map<string, Job>;
  hour: number;
  weather?: string; season?: string; weekday?: number;
  crowd(placeId: string): number;
  price(place: Place, item: string): number | null;
  path(from: string, to: string): string | null;
  /** roads between two places, when the town can count them; without it habit keeps its fixed preferences */
  hops?(from: string, to: string): number | null;
}

/**
 * Tier 0. What a person does without thinking: eat, sleep, go to work, drift toward people.
 * Runs every tick for every agent and costs nothing. It never makes a decision with stakes.
 */
export function habit(a: AgentState, v: HabitView): Action {
  const here = v.places.get(a.location)!;
  const wake = 6 + Math.round(a.persona.traits.caution * 1.5);

  if (a.asleep) {
    if (v.hour >= wake && a.needs.rest < 0.4) return { kind: "wait" }; // wake handled by engine
    return { kind: "sleep" };
  }

  // Night: find a bed.
  if (v.hour >= 22 || (v.hour >= 21 && a.needs.rest > 0.85)) {
    const bedPlace = chooseBed(a, v);
    if (bedPlace === a.location) return { kind: "sleep" };
    const next = v.path(a.location, bedPlace);
    return next ? { kind: "move", to: next } : { kind: "wait" };
  }

  // Hunger: eat what is carried, buy what is sold here. A shift is worked hungry and the meal comes after; walking off to look for food is for the hours outside it, unless the body is already failing. The mind can overrule any of this.
  const onShift = !!a.job && v.weekday !== 0 && (() => { const j = v.jobs.get(a.job!); return !!j && v.hour >= j.hours[0] && v.hour < j.hours[1]; })() && a.starving < 2;
  if (a.needs.hunger > 0.6) {
    const has = a.inventory.find((i) => FOOD_ITEMS.has(i));
    if (has) return { kind: "use", item: has };
    const cheapest = cheapestFood(here, v);
    if (cheapest && a.coins >= cheapest.price) return { kind: "trade", with: here.id, buy: cheapest.item, coins: cheapest.price };
    const target = onShift ? null : nearestFoodPlace(a, v);
    if (target && target !== a.location) {
      const next = v.path(a.location, target);
      if (next) return { kind: "move", to: next };
    }
  }

  // Weak with hunger and no coins: go where people are and stay there; a thought will have to do the rest.
  if (a.starving >= 2 && a.coins === 0 && v.hour >= 7 && v.hour < 21 && a.location !== "market" && a.location !== "inn") { const next = v.path(a.location, v.crowd("inn") >= v.crowd("market") ? "inn" : "market"); if (next) return { kind: "move", to: next }; }
  // Sunday: the chapel at ten, for those so inclined; no shifts
  if (v.weekday === 0) {
    if (v.hour === 10 && a.location !== "chapel" && v.places.has("chapel") && (a.persona.traits.caution + a.persona.traits.warmth) / 2 > 0.45 && a.needs.hunger < 0.6) { const next = v.path(a.location, "chapel"); if (next) return { kind: "move", to: next }; }
  }
  // Work: be at work during hours.
  if (a.job && v.weekday !== 0) {
    const job = v.jobs.get(a.job);
    if (job && v.hour >= job.hours[0] && v.hour < job.hours[1]) {
      if (a.location === job.place) return { kind: "work" };
      const next = v.path(a.location, job.place);
      if (next) return { kind: "move", to: next };
    }
  }

  // A site of your own: turn up and work on it whenever you are not at your job.
  const site = [...v.places.values()].find((p) => p.site?.by === a.id);
  if (site && v.hour >= 8 && v.hour < 18 && !(a.job && (() => { const j = v.jobs.get(a.job!); return j && v.hour >= j.hours[0] && v.hour < j.hours[1]; })())) {
    if (a.location === site.id) return { kind: "work" };
    const next = v.path(a.location, site.id);
    if (next) return { kind: "move", to: next };
  }

  // No job: go where the work is, so a thought can be spent on applying there.
  if (!a.job && v.hour >= 6 && v.hour < 17) {
    const open = [...v.jobs.values()].filter((j) => j.holders.length < j.slots);
    if (open.length > 0) {
      // pick a place with work and keep walking to it: the list of open jobs shifts every minute as people are taken on, and a person who re-picked each minute walked in circles
      // the ambitious pick by their own lights; everyone else takes the nearest post going
      const places = [...new Set(open.map((j) => j.place))];
      const nearest = v.hops ? [...places].sort((x, y) => (v.hops!(a.location, x) ?? 99) - (v.hops!(a.location, y) ?? 99))[0]! : null;
      const target = places.includes(a.location) ? a.location : a.heading && places.includes(a.heading) ? a.heading : a.persona.traits.ambition > 0.6 || !nearest ? places[Math.floor(a.persona.traits.ambition * places.length) % places.length]! : nearest;
      if (target !== a.location) { if (!a.heading) a.heading = target; const next = v.path(a.location, target); if (next) return { kind: "move", to: next }; } // a heading the town set (a bell, a gathering) is never overwritten
      return { kind: "wait" };
    }
  }

  // Rain sends the idle indoors; a storm sends everyone.
  const wet = v.weather === "rain" || v.weather === "storm" || v.weather === "snow";
  if (wet && (v.weather === "storm" || a.needs.social < 0.7)) {
    const here = v.places.get(a.location)!;
    const indoors = here.kind === "inn" || here.kind === "home" || here.kind === "shop" || here.kind === "workplace" || here.kind === "civic" || here.id === "tavern" || here.id === "chapel";
    if (!indoors) {
      const shelter = ["inn", "tavern", "chapel", "market"].map((id) => v.places.get(id)).filter((p): p is Place => !!p).sort((x, y) => (v.path(a.location, x.id) ? 0 : 1) - (v.path(a.location, y.id) ? 0 : 1))[0];
      if (shelter && shelter.id !== a.location) { const next = v.path(a.location, shelter.id); if (next) return { kind: "move", to: next }; }
    }
  }
  // Social: drift toward people in public places.
  if (a.needs.social > 0.5 && v.hour >= 8 && v.hour < 22) {
    const candidates = (wet ? ["inn", "tavern"] : ["market", "inn", "tavern", "harbor"]).filter((p) => p !== a.location);
    let best: string | null = null; let bestCrowd = v.crowd(a.location);
    for (const c of candidates) { const n = v.crowd(c); if (n > bestCrowd) { best = c; bestCrowd = n; } }
    if (best) { const next = v.path(a.location, best); if (next) return { kind: "move", to: next }; }
  }

  return { kind: "wait" };
}

export function chooseBed(a: AgentState, v: HabitView): string {
  if (a.home && a.home.nightsPaid > 0) return a.home.place;
  const inn = v.places.get("inn")!;
  if (a.coins >= (inn.beds?.price ?? 99) && (inn.freeBeds ?? 0) > 0) return "inn";
  return "boatshed";
}

function cheapestFood(here: Place, v: HabitView): { item: string; price: number } | null {
  let best: { item: string; price: number } | null = null;
  for (const s of here.sells) {
    if (!FOOD_ITEMS.has(s.item)) continue;
    const p = v.price(here, s.item);
    if (p !== null && (best === null || p < best.price)) best = { item: s.item, price: p };
  }
  return best;
}

/** Where food is on the shelf and within the purse today: the nearest such place by the roads, the market first among equals; failing that, the nearest place that sells food at all. Nothing sold-out draws anyone. */
function nearestFoodPlace(a: AgentState, v: HabitView): string | null {
  const order = ["market", "inn", "bakery", "fields"]; const rank = (id: string) => { const i = order.indexOf(id); return i < 0 ? order.length : i; };
  const far = (id: string) => v.hops ? (v.hops(a.location, id) ?? 99) : 0;
  const sellers = [...v.places.values()].filter((p) => p.sells.some((s) => FOOD_ITEMS.has(s.item))).sort((x, y) => far(x.id) - far(y.id) || rank(x.id) - rank(y.id));
  for (const p of sellers) { const c = cheapestFood(p, v); if (c && a.coins >= c.price) return p.id; }
  return sellers[0]?.id ?? null;
}
