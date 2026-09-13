// Only public happenings belong on the landing page. Never forward event payloads.
const kinds: Record<string, string> = {
  "agent.arrive": "An arrival", "agent.say": "On the street", "agent.work": "At work",
  "agent.trade": "An exchange", "agent.give": "A small kindness", "agent.hired": "A new job",
  "agent.build": "Taking shape", "town.built": "Built by citizens", "town.gathering": "Together",
  "town.recipe": "An invention", "town.rule": "A new rule", "building.repaired": "Made better",
};
export function dispatchItems(events: unknown) {
  if (!Array.isArray(events)) return [];
  const seen = new Set<string>();
  return events.slice().reverse().filter((event) => {
    if (!event || typeof event.kind !== "string" || !Object.hasOwn(kinds, event.kind) || typeof event.text !== "string" || !event.text.trim() || !Number.isFinite(event.t) || !Number.isFinite(event.id) || seen.has(event.text)) return false;
    seen.add(event.text);
    return true;
  }).slice(0, 3).map(event => ({ id: event.id as number, t: event.t as number, text: event.text as string, label: kinds[event.kind]! }));
}
