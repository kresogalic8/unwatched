export const BENCH_SCALE_Y = .65;
export type Seat = { key: string; x: number; y: number; height: number; facing: -1 | 1 };
/** Anchor geometry follows the bench and the 0.85-scale Harbor terrace drawings. */
export function seatsFor(prop: { sprite: string; x: number; y: number }, index: number): Seat[] {
  if (prop.sprite === "bench") return [-14, 14].map((offset) => ({ key: `${index}:${offset}`, x: prop.x + offset, y: prop.y + 2, height: -16 * BENCH_SCALE_Y - 2, facing: 1 }));
  if (prop.sprite === "terrace" || prop.sprite === "parasol") return [-1, 1].map(side => ({ key: `${index}:${side}`, x: prop.x + side * 32 * .85, y: prop.y + 6 * .85, height: -15 * .85, facing: side < 0 ? 1 : -1 }));
  return [];
}
