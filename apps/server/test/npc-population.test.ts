import {describe,it,expect} from "vitest";
import {Town,Rng} from "@unwatched/engine";
import {MockBrain,seedPersonas} from "@unwatched/cognition";
import {npcReduction} from "../src/npc-population.ts";
function fixture(){const t=new Town({seed:42,brain:new MockBrain(42)});for(const p of seedPersonas(new Rng(42),15))t.addAgent({persona:p,owner:null});return t;}
describe("NPC reduction",()=>{
 it("keeps owned citizens and civic/property roles out of the proposal",()=>{const t=fixture();const a=[...t.agents.values()];a[0]!.owner="user";t.mayor=a[1]!.id;t.places.get("inn")!.owner=a[2]!.id;const plan=npcReduction(t,10);expect(plan.current).toBe(14);expect(plan.selected).toHaveLength(4);expect(plan.selected.map(a=>a.id)).not.toContain(a[0]!.id);expect(plan.selected.map(a=>a.id)).not.toContain(a[1]!.id);expect(plan.selected.map(a=>a.id)).not.toContain(a[2]!.id);expect(t.agents.size).toBe(15);});
 it("does not force removal when too many citizens are protected",()=>{const t=fixture();for(const a of [...t.agents.values()].slice(0,11))a.persona.age=17;const plan=npcReduction(t,10);expect(plan.canReachTarget).toBe(false);expect(plan.remaining).toBeGreaterThan(10);});
 it("is deterministic, rejects unsafe targets, and never adds residents",()=>{const t=fixture();expect(npcReduction(t,10)).toEqual(npcReduction(t,10));expect(()=>npcReduction(t,0)).toThrow();for(const a of [...t.agents.values()].slice(0,10))a.owner="user";expect(npcReduction(t,10).selected).toEqual([]);});
});
