/** Bounded experiential learning. Evidence is recorded by the engine, never supplied by a model. */
export type PurchaseExperience = { t: number; success: boolean; cost: number; eventId?: number };
export type FoodLesson = { place: string; item: string; evidence: PurchaseExperience[] };
export function recordPurchase(lessons: FoodLesson[], place: string, item: string, experience: PurchaseExperience): void {
  let lesson = lessons.find(l => l.place === place && l.item === item);
  if (!lesson) { lesson = { place, item, evidence: [] }; lessons.push(lesson); }
  // Repeated rejected calls in the same hour are one observation, not growing certainty.
  if (!experience.success && lesson.evidence.some(e => !e.success && Math.floor(e.t / 60) === Math.floor(experience.t / 60))) return;
  lesson.evidence.push(experience); lesson.evidence = lesson.evidence.slice(-16);
  if (lessons.length > 24) lessons.splice(0, lessons.length - 24);
}
export function foodExperience(lessons: FoodLesson[] | undefined, place: string, item: string, now: number) {
  const evidence = lessons?.find(l => l.place === place && l.item === item)?.evidence ?? [];
  let successes = 0, failures = 0;
  for (const e of evidence) {
    const weight = Math.pow(.5, Math.max(0, now - e.t) / (7 * 1440));
    if (e.success) successes += weight; else failures += weight;
  }
  // A neutral prior and seven-day half-life keep beliefs tentative and reversible.
  return { confidence: (1 + successes) / (2 + successes + failures), observations: evidence.length };
}

export type FoodRoutineDecision = { t: number; from: string; next: string; baseline: string; preferred: string };
