import type { Place, Job } from "./types.ts";
import type { AgentId } from "@unwatched/protocol";
import { ISLAND, type WorldPack } from "./packs/island.ts";

export { ISLAND } from "./packs/island.ts";
export type { WorldPack, PlaceSpec, JobSpec, ProduceSpec, SupplySpec, ExportSpec, FeastSpec } from "./packs/island.ts";

/** The island, from a world pack. Roads run both ways; unowned businesses start with their float in the till. */
export function makePlaces(pack: WorldPack = ISLAND): Map<string, Place> {
  const list: Place[] = pack.places.map((p) => ({ id: p.id, name: p.name, kind: p.kind, district: p.district, sprite: p.sprite, x: p.x, y: p.y, exits: [...p.exits], sells: p.sells ? p.sells.map((s) => ({ ...s })) : [], owner: null, site: null, treasury: pack.float[p.id] ?? 0, stock: { ...(p.stock ?? {}) }, ...(p.beds ? { beds: { ...p.beds }, freeBeds: p.beds.capacity } : {}) }));
  for (const p of list) for (const e of p.exits) { const q = list.find((x) => x.id === e); if (q && !q.exits.includes(p.id)) q.exits.push(p.id); }
  for (const p of list) stockShelf(pack, p);
  return new Map(list.map((p) => [p.id, p]));
}

/** What a shelf starts with when the pack says nothing: the cart's ceiling where the cart fills it, else a few. A shelf with no count would be a bottomless one. */
export function startingStock(pack: WorldPack, placeId: string, item: string): number {
  const line = pack.supply.find((l) => l.to === placeId && l.item === item); if (line?.upTo !== undefined) return line.upTo;
  return FOOD_ITEMS.has(item) ? 6 : 4;
}
/** Every item on sale gets a count, so nothing sells that is not there. */
export function stockShelf(pack: WorldPack, place: Place): void { for (const s of place.sells) if (place.stock[s.item] === undefined) place.stock[s.item] = startingStock(pack, place.id, s.item); }
/** What goes off on the shelf overnight. Grain, flour, planks, stone, timber, rope and oil keep. */
export const PERISHABLE = new Set(["bread", "fish", "soup"]);

export function makeJobs(pack: WorldPack = ISLAND): Map<string, Job> {
  return new Map(pack.jobs.map((j) => [j.id, { ...j, hours: [...j.hours] as [number, number], holders: [] }]));
}

/** What can be built on a plot: the price of the land and materials, paid to the council, and the mornings of work it takes. */
/** Public works the mayor can fund from the council treasury, and what each one does to the island. */
export const WORKS: Record<string, { coins: number; describe: string }> = {
  granary: { coins: 50, describe: "a granary: sixty grain laid in at the mill, so a bad month does not mean no bread" },
  bathhouse: { coins: 60, describe: "a bathhouse: everyone sleeps better and wakes rested sooner" },
  bridge: { coins: 40, describe: "a bridge between the two places farthest apart, so the walk is short" },
};
export const BUILDS: Record<"house" | "shop", { coins: number; labor: number; planks: number; describe: string }> = {
  house: { coins: 15, labor: 6, planks: 6, describe: "a house with two beds; the builder sleeps free and can let the other bed; takes six planks from the sawpit" },
  shop: { coins: 30, labor: 10, planks: 10, describe: "a shop that sells bread, soup and drink, keeps what it earns, and can take on one helper; takes ten planks from the sawpit" },
};
/** Loose words a person might use for what they mean to build. */
export function buildKind(what: string): keyof typeof BUILDS | null {
  const w = what.toLowerCase().trim(); if (!w) return null;
  if (/shop|store|stall|bakery|tavern|inn|cafe|café|kitchen|smithy|workshop|forge|boatyard|yard|shed|mill|press|studio|office|school|library|chapel|hall/.test(w)) return "shop";
  return "house"; // anything else someone wants to raise is a place to live in
}
/** A short stable name for how a building looks, from the builder's own words. The sprite is "look:<hash>"; the island keeps the drawing under it. */
export function lookHash(look: string): string { let h = 5381; for (const ch of look.trim().toLowerCase()) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return h.toString(36); }
/** The site's name once someone names it, else the builder's. */
export function siteName(kind: keyof typeof BUILDS, by: string, name: string | undefined): string {
  if (name && name.trim()) return name.trim().slice(0, 60);
  const first = by.split(" ")[0] ?? by;
  return kind === "house" ? `${first}'s house` : `${first}'s shop`;
}
export type BuildKind = keyof typeof BUILDS;
export const owns = (p: Place, id: AgentId) => p.owner === id;

export const FOOD_ITEMS = new Set(["bread", "soup", "apples", "fish"]);
export const MINUTES_PER_DAY = 24 * 60;
export const SEASONS = ["winter", "spring", "summer", "autumn"] as const;
