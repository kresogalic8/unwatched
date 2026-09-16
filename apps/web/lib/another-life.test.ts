import { describe,it,expect } from "vitest";
import { Persona } from "@unwatched/protocol";
import { personaFromLife, type LifeDraft } from "./another-life";
const draft:LifeDraft={step:3,question:4,mode:"self",answers:[1,0,2,1,0],person:{name:"Mara",strength:"Fixing things",flaw:"Overcommitting",habit:"Morning coffee",dream:"Open a workshop"},note:"Reserved at first, playful with friends.",hair:"Bob",color:"Teal",age:32};
describe("another-life boarding",()=>{
 it("preserves personal details in the protocol passed to the mind",()=>{const p=Persona.parse(personaFromLife(draft));expect(p.skill).toBe(draft.person.strength);expect(p.habit).toBe(draft.person.habit);expect(p.flaw).toBe(draft.person.flaw);expect(p.want).toBe(draft.person.dream);expect(p.summary).toContain(draft.note);expect(p.summary).toContain("Make something with my hands");expect(p.summary).toContain("Try again");expect(p.secret).toBe("");});
 it("does not invent optional details and honors a different answer",()=>{const p=personaFromLife({...draft,answers:[0,1,0,0,1],person:{...draft.person,habit:"",strength:"",flaw:""}});expect(p.habit).toBeUndefined();expect(p.skill).toBeUndefined();expect(p.flaw).toBeUndefined();expect(p.strangers).toContain("Pull up a chair");expect(p.advice).toContain("trusted perspective");expect(p.traits.caution).toBeLessThan(personaFromLife(draft).traits.caution);});
});
