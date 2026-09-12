import type { TownEvent, BuildingMoment } from "@unwatched/protocol";
import type { Place, AgentState } from "./types.ts";

const kinds: Record<string, BuildingMoment["kind"]> = { "agent.build": "started", "agent.work": "worked", "town.built": "finished", "deal.offered": "offered", "deal.accepted": "accepted", "deal.refused": "refused", "deal.kept": "paid", "deal.broken": "broken" };

/** Capture only executed construction facts. The rolling event id is deliberately not the archive key. */
export function recordBuildingMoment(e: TownEvent, places: Map<string, Place>, agents: Map<string, AgentState>): void {
  const kind = kinds[e.kind]; if (!kind) return;
  const deal = e.kind.startsWith("deal.") ? agents.get(e.actors[0] ?? "")?.deals.find((d) => d.id === e.payload?.deal) : undefined;
  if (e.kind.startsWith("deal.") && !deal?.construction) return;
  const place = places.get(deal?.construction?.site ?? e.place ?? "");
  const h = place?.history; if (!h) return;
  if (deal?.construction && Math.floor(h.started / 1440) + 1 !== deal.construction.startedDay) return;
  if (kind === "worked" && (!place?.site || typeof e.payload?.labor !== "number")) return;
  h.moments.push({
    sequence: h.moments.length + 1, t: e.t, day: e.day, kind,
    text: kind === "paid" ? `${agents.get(e.actors[0]!)?.persona.name ?? e.actors[0]} received ${deal!.coins} coins for the agreed building work.` : e.text,
    labor: kind === "finished" ? h.needed : place?.site?.labor ?? h.moments.at(-1)?.labor ?? 0,
    people: e.actors.map((id) => ({ id, name: agents.get(id)?.persona.name ?? id })),
    ...(deal ? { deal: deal.id, coins: deal.coins } : {}),
  });
}
