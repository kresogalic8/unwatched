import type { TownEvent } from '@unwatched/protocol';
export interface EvolutionStory { id:string; title:string; started:number; updated:number; total:number; moments:{id:number;t:number;day:number;kind:string;text:string;actors:string[];simulated:boolean;success:boolean|null}[] }
const tracked=new Set(['place.decorated','skill.proposed','skill.tested','skill.practiced','skill.shared','building.repaired','project.proposed','project.contributed','town.built','town.recipe','institution.founded','institution.joined','institution.left']);
export function recordEvolution(stories:EvolutionStory[], e:TownEvent) {
 if(!tracked.has(e.kind))return;
 const id=typeof e.payload?.skill==='string'?`skill-${e.payload.skill}`:e.place?`place-${e.place}`:`event-${e.id}`;
 let story=stories.find(s=>s.id===id);if(!story){story={id,title:e.text,started:e.t,updated:e.t,total:0,moments:[]};stories.push(story);}
 story.updated=e.t;story.total++;story.moments.push({id:e.id,t:e.t,day:e.day,kind:e.kind,text:e.text,actors:[...e.actors],simulated:e.payload?.simulated===true,success:typeof e.payload?.success==='boolean'?e.payload.success:null});
 story.moments=story.moments.slice(-40);
 if(stories.length>64){stories.sort((a,b)=>a.updated-b.updated);stories.splice(0,stories.length-64);}
}
