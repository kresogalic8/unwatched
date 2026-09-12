/** Preview links may omit zoom; an absent value must never become zoom zero. */
export function previewZoom(value: string | null | undefined): number {
  if (value == null || value.trim() === "") return NaN;
  const zoom = Number(value);
  return Number.isFinite(zoom) && zoom > 0 ? Math.min(1.9, Math.max(0.55, zoom)) : NaN;
}

/** Integrate the same decaying velocity at 30, 60 or 120 Hz. */
export function coast(velocity: number, frames: number): { distance: number; velocity: number } {
  const elapsed = Math.min(3, Math.max(0, frames));
  const decay = Math.pow(0.86, elapsed);
  return { distance: velocity * (1 - decay) / (1 - 0.86), velocity: velocity * decay };
}
