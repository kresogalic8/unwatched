import { DesireUpdate, type Desire, type TownEvent } from "@unwatched/protocol";
import { sha256 } from "./hash.ts";

/** Only personal experiences supplied to this reflection can support a change. */
export function desireEvidence(events: TownEvent[], agent: string, since: number): TownEvent[] {
  return events.filter(e => e.t >= since && e.actors.includes(agent) &&
    !["agent.reflect", "agent.became", "agent.self", "agent.letter", "town.notice", "relation.change"].includes(e.kind)).slice(-24);
}
export function reviseDesires(current: Desire[], updates: unknown[], evidence: TownEvent[], t: number, agent: string): Desire[] {
  const result = structuredClone(current);
  for (const raw of updates.slice(0, 2)) {
    const parsed = DesireUpdate.safeParse(raw);
    if (!parsed.success) continue;
    const u = parsed.data;
    const receipts = [...new Set(u.evidence)].map(id => evidence.find(e => e.id === id && e.actors.includes(agent) && e.t <= t));
    if (receipts.some(e => !e)) continue;
    let d = u.id ? result.find(d => d.id === u.id) : result.find(d => d.title.toLowerCase() === u.title.toLowerCase());
    if (u.id && !d) continue;
    if (d && Math.floor(d.updated / 1440) === Math.floor(t / 1440)) continue;
    if (u.state === "active" && d?.state !== "active" && result.filter(d => d.state === "active").length >= 3) continue;
    if (!d) {
      if (u.state !== "active") continue;
      if (result.length >= 8) {
        const archived = result.findIndex(d => d.state !== "active");
        if (archived < 0) continue;
        result.splice(archived, 1);
      }
      d = { id: sha256(`${agent}:${t}:${u.title}`).slice(0, 20), title: u.title, why: u.why, state: u.state, since: t, updated: t, history: [], attempts: [] };
      result.push(d);
    }
    d.title = u.title; d.why = u.why; d.state = u.state; d.updated = t;
    d.history.push({ t, title: u.title, why: u.why, state: u.state, evidence: receipts.map(e => ({ id: e!.id, t: e!.t, kind: e!.kind, text: e!.text.slice(0, 600) })) });
    d.history = d.history.slice(-8);
  }
  return result;
}
export function recordDesireAttempt(desires: Desire[], id: string | undefined, t: number, action: string, accepted: boolean, events: TownEvent[]) {
  const d = desires.find(d => d.id === id && d.state === "active");
  if (!d) return;
  d.attempts.push({ t, action, accepted, events: events.slice(-3).map(e => ({ id: e.id, text: e.text.slice(0, 600), kind: e.kind })) });
  d.attempts = d.attempts.slice(-8);
}

/** Keep recurring model context small; full history is for the private owner view. */
export function desiresForMind(desires: Desire[] = []) {
  return [...desires.filter(d => d.state === "active"), ...desires.filter(d => d.state !== "active").sort((a,b) => b.updated-a.updated).slice(0,2)].slice(0,5).map(d => {
    const last = d.attempts.at(-1);
    return { id:d.id, title:d.title, why:d.why, state:d.state, since:d.since, updated:d.updated, ...(last ? {last_attempt:{t:last.t,action:last.action,accepted:last.accepted}, recent_attempts:d.attempts.slice(-3).map(a => ({t:a.t,action:a.action,accepted:a.accepted,outcomes:a.events.slice(-2).map(e => ({...e,text:e.text.slice(0,240)}))}))} : {}) };
  });
}

const concreteOutcomes = new Set(["agent.move","action.rejected","building.repaired","item.crafted","agent.give","agent.trade","agent.work","agent.hired","agent.build","town.built"]);
/** Recent personal facts, including travel: semantic memory retrieval can miss repetition. */
export function recentActionOutcomes(events: TownEvent[], agent: string, t: number) {
  const result: {t:number;kind:string;text:string}[]=[];
  for(let i=events.length-1;i>=0&&result.length<6;i--){
    const e=events[i]!;
    if(e.t<t-1440)break;
    if(e.t<=t&&e.actors.includes(agent)&&concreteOutcomes.has(e.kind)) result.push({t:e.t,kind:e.kind,text:e.text.slice(0,240)});
  }
  return result.reverse();
}
