import type { Town } from "@unwatched/engine";
/** Only ownerless hosted adults are candidates. Keep established ties and civic roles. */
export function npcReduction(town:Town,target:number){
 if(!Number.isInteger(target)||target<5||target>10)throw new Error("Choose a target between 5 and 10.");
 const npcs=[...town.agents.values()].filter(a=>!a.owner);
 const users=[...town.agents.values()].filter(a=>!!a.owner);
 const protectedIds=new Set<string>();
 for(const a of npcs){
  if(a.brainKind!=="hosted"||a.persona.age<18||town.mayor===a.id||town.children.some(c=>c.parents.includes(a.id))||[...town.places.values()].some(p=>p.owner===a.id))protectedIds.add(a.id);
  if(users.some(u=>{const r=u.relationships.get(a.id),back=a.relationships.get(u.id);return (r?.trust??0)>.5||(r?.affection??0)>.4||(back?.trust??0)>.5||(back?.affection??0)>.4;}))protectedIds.add(a.id);
 }
 // Keep one current worker in each occupied role so downsizing does not empty a workplace.
 for(const job of town.jobs.values()){
  const workers=job.holders.map(id=>town.agents.get(id)).filter(a=>a!==undefined);
  if(workers.some(a=>a.owner||protectedIds.has(a.id)))continue;
  const keeper=workers.sort((a,b)=>a.id.localeCompare(b.id))[0];if(keeper)protectedIds.add(keeper.id);
 }
 // Unemployed citizens leave first; ties within the town break ties, then stable IDs.
 const candidates=npcs.filter(a=>!protectedIds.has(a.id)).sort((a,b)=>Number(!!a.job)-Number(!!b.job)||a.relationships.size-b.relationships.size||a.id.localeCompare(b.id));
 const needed=Math.max(0,npcs.length-target);
 const selected=candidates.slice(0,needed).map(a=>({id:a.id,name:a.persona.name,job:a.job}));
 return {target,current:npcs.length,remaining:npcs.length-selected.length,protected:protectedIds.size,canReachTarget:candidates.length>=needed,selected};
}
