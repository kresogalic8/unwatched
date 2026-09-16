import type { Persona } from "@unwatched/protocol";
import type { Look } from "@/components/world/citizen";
export const situations = [
 { title:"You arrive somewhere you know nobody.", detail:"There’s a crowded table by the harbor. One seat is free.", answers:["Pull up a chair. Someone has to say hello.","Watch for a while. Find one person to talk to.","Take a walk first. I like finding my own way."], traits:["Makes the first move","Connects slowly, but deeply","Comfortable on their own"] },
 { title:"Someone takes credit for your work.", detail:"Everyone is congratulating them. You’re standing right there.", answers:["Say something, even if it gets awkward.","Talk to them later, in private.","Let it go. But I won’t forget it."], traits:["Speaks up under pressure","Chooses a quiet conversation","Carries things left unsaid"] },
 { title:"An opportunity interrupts your plans.", detail:"A neighbor wants to open a little café together. It might fail.", answers:["Let’s try. We’ll work it out as we go.","Make a small plan before committing.","Keep my independence. Offer to help instead."], traits:["Takes a chance on possibility","Builds confidence through a plan","Protects their independence"] },
 { title:"You finally have an evening to yourself.", detail:"No deadlines. Nobody needs you. What feels most like you?", answers:["Find my people. Cook, talk, stay up late.","Make something with my hands.","Somewhere quiet, with no expectations."], traits:["Recharges around people","Finds peace in making things","Needs room to breathe"] },
 { title:"Something you care about goes wrong.", detail:"A project fails after weeks of work. Tomorrow is a blank page.", answers:["Try again. I’m not finished with this.","Ask someone I trust for a fresh perspective.","Step away. Maybe I want something different."], traits:["Stays with a difficult thing","Lets trusted people in","Knows when to change direction"] },
];
export type LifeDraft = { step:number; question:number; mode:string; answers:number[]; person:{name:string; strength:string; flaw:string; habit:string; dream:string}; note:string; hair:string; color:string; age:number };
/** Translate only what was supplied. Empty depth fields remain optional; no invented secrets. */
export function personaFromLife(d:LifeDraft):Persona {
 const a=(i:number)=>d.answers[i]??-1;
 const choices=situations.flatMap((q,i)=>q.answers[a(i)]?[`${q.title} ${q.answers[a(i)]}`]:[]);
 return {name:d.person.name.trim(),age:Math.max(16,Math.min(99,Math.round(d.age))),origin:"the mainland",
 summary:[...choices,d.note.trim()].filter(Boolean).join("\n"),want:d.person.dream.trim(),fear:"",secret:"",
 strangers:situations[0]!.answers[a(0)]??"", advice:a(4)===1?"Seeks a trusted perspective when things go wrong.":"Decides for themselves whether advice fits.",
 traits:{warmth:a(0)===0?.75:a(0)===1?.55:.35,pride:a(1)===0?.7:a(1)===1?.5:.55,caution:a(2)===0?.3:a(2)===1?.75:.6,honesty:.5,ambition:a(4)===0?.75:a(4)===1?.6:.5},
 skill:d.person.strength.trim().slice(0,120)||undefined,flaw:d.person.flaw.trim()||undefined,habit:d.person.habit.trim()||undefined,cameBecause:d.person.dream.trim()||undefined};
}
export function lookFromLife(d:LifeDraft):Partial<Look>{return {hair:d.hair as Look["hair"],top:d.color as Look["top"]};}
