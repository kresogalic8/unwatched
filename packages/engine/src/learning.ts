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

/** Hearsay never becomes a receipt. Only the recipient's own later attempt can test it. */
export type FoodAdvice = {
  from: string; place: string; item: string; confidence: number;
  sourceT: number; sharedT: number; eventId: number;
  tested?: { t: number; success: boolean; matched: boolean };
};
export const ADVICE_LIFETIME = 7 * 1440;
export function teachable(lessons: FoodLesson[] | undefined, place: string, item: string, now: number) {
  const lesson = lessons?.find(l => l.place === place && l.item === item);
  const last = lesson?.evidence.at(-1);
  if (!last || now < last.t || now - last.t > ADVICE_LIFETIME) return null;
  return { sourceT: last.t, ...foodExperience(lessons, place, item, now) };
}
/** Only the most trusted current, untested tip contributes, as less than one observation. */
export function socialFoodConfidence(
  lessons: FoodLesson[] | undefined, advice: FoodAdvice[] | undefined,
  relationships: Map<string, { trust: number }>, place: string, item: string, now: number,
): number {
  const own = foodExperience(lessons, place, item, now);
  const tip = (advice ?? []).filter(x => x.place === place && x.item === item && !x.tested && now >= x.sourceT && now - x.sourceT <= ADVICE_LIFETIME)
    .sort((a,b) => (relationships.get(b.from)?.trust ?? .3) - (relationships.get(a.from)?.trust ?? .3))[0];
  if (!tip) return own.confidence;
  const trust = Math.max(0, (relationships.get(tip.from)?.trust ?? .3) - .2);
  const weight = trust * Math.pow(.5, (now - tip.sourceT) / (2 * 1440));
  return (own.confidence * (2 + own.observations) + tip.confidence * weight) / (2 + own.observations + weight);
}
