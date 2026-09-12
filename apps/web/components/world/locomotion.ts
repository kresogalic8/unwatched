/** World pixels per second. Brake before arrival, without overshooting the target. */
export function advanceWalk(distance: number, speed: number, targetSpeed: number, dt: number) {
  const seconds = Math.max(0, Math.min(.05, dt));
  if (distance <= .01) return { speed: 0, distance: 0 };
  const acceleration = 140;
  const desired = Math.min(targetSpeed, Math.sqrt(2 * acceleration * distance));
  const next = speed + Math.max(-acceleration * seconds, Math.min(acceleration * seconds, desired - speed));
  const travel = Math.min(distance, (speed + next) * .5 * seconds);
  return { speed: travel >= distance ? 0 : next, distance: travel };
}

/** A dead band prevents diagonal routes from switching front/profile every frame. */
export function walkFacing(dx: number, dy: number, previous: "left" | "right" | "front" | "back") {
  const vertical = previous === "front" || previous === "back";
  if (Math.abs(dy) > Math.abs(dx) * (vertical ? 1.1 : 1.5)) return dy > 0 ? "front" : "back";
  if (Math.abs(dx) < .1) return previous;
  return dx < 0 ? "left" : "right";
}
