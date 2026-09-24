/**
 * The miniature's modeller's touch for the world-styles study: the buildings as painted models, their edges picked out light
 * the way a modeller dry-brushes them. The table, plinth and grade are the town's own (components/world/diorama.ts).
 */
import type { Graphics } from "pixi.js";
import { RISE, isoFor, type Spec, type Sun } from "./light";
export { BAY, PLINTH, TABLE, drawTable, dioramaGrade } from "@/components/world/diorama";
import { drawPlinth as plinthAt } from "@/components/world/diorama";

/** The plinth lit by the study's sun. */
export const drawPlinth = (shadow: Graphics, sides: Graphics, rim: [number, number][], sun: Sun) => plinthAt(shadow, sides, rim, sun.L[0]);

/**
 * A painted model's edges: a thin pale line along every outside corner, ridge and eave, the modeller's dry-brush,
 * plus a soft gloss on the roof that follows the lamp. Drawn with an add blend over the building.
 */
export function drybrush(g: Graphics, spec: Spec, sun: Sun): void {
  g.clear(); const { w, d, h } = spec; const q = isoFor(spec);
  const edge = (a: [number, number], b: [number, number], alpha: number) => g.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: 1.1, color: 0xfff6e0, alpha, cap: "round" });
  edge(q(-7, d / 2, h + RISE), q(w + 7, d / 2, h + RISE), 0.55);
  edge(q(-7, d + 6, h), q(w + 7, d + 6, h), 0.4);
  edge(q(w + 7, -6, h), q(w + 7, d / 2, h + RISE), 0.4); edge(q(w + 7, d / 2, h + RISE), q(w + 7, d + 6, h), 0.4);
  edge(q(w, d, 1), q(w, d, h - 1), 0.35); edge(q(0, d, 1), q(0, d, h - 1), 0.18); edge(q(w, 0, 1), q(w, 0, h - 1), 0.18);
  edge(q(0, d, 0.5), q(w, d, 0.5), 0.12); edge(q(w, d, 0.5), q(w, 0, 0.5), 0.12);
  // gloss: a soft oval where the lamp catches the painted tiles, sliding along the roof with the light
  const day = sun.up ? 1 - sun.night : 0.25; const along = 0.5 + 0.35 * Math.max(-1, Math.min(1, sun.L[0] - sun.L[1]));
  const [gx, gy] = q(-7 + (w + 14) * along, d * 0.72, h + RISE * 0.45);
  for (const [r, a] of [[26, 0.05], [15, 0.07], [7, 0.08]] as const) g.ellipse(gx, gy, r * 1.6, r * 0.55).fill({ color: 0xffffff, alpha: a * day });
}

