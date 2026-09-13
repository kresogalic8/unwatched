/** Controlled engine fixture. Never used as proof of autonomous discovery. No model calls. */
import {writeFileSync} from 'node:fs';
import {Town,type Brain} from '../packages/engine/src/index.ts';
const no=async():Promise<never>=>{throw Error('This scenario cannot call a model');};
const brain:Brain={name:'none',decide:no,converse:no,reflect:no,plan:no,digest:no,child:no,writePaper:no,life:no,judge:no};
async function main(){
const t=new Town({seed:7,brain,name:'Workshop study'});t.t=600;
function person(name:string){const a=t.addAgent({persona:{name,age:38,origin:'the coast',summary:'A patient neighbor who wants to help.',want:'repair the mill and share what works',fear:'careless work',secret:'private',strangers:'polite',advice:'test it',traits:{warmth:.8,pride:.4,caution:.7,honesty:.9,ambition:.6}}});a.location='mill';a.inventory=['planks','planks','planks','planks'];return a;}
const mira=person('Mira'),ivo=person('Ivo');t.places.get('mill')!.owner=mira.id;t.places.get('mill')!.brokenUntil=t.day+3;
const recipe={name:'Repair before reopening',goal:'repair' as const,steps:[{kind:'repair' as const}]};
t.apply(mira,{kind:'propose_skill',recipe},'scripted-fixture');const id=mira.skills![0]!.id;
t.apply(mira,{kind:'test_skill',id},'scripted-fixture');t.apply(mira,{kind:'practice_skill',id},'scripted-fixture');await t.tick();
ivo.location=mira.location;t.apply(mira,{kind:'share_skill',id,to:ivo.id},'scripted-fixture');
t.apply(mira,{kind:'found_institution',name:'The patient workshop',charter:'Test ideas, share what works, and leave everyone free to choose.'},'scripted-fixture');
t.apply(ivo,{kind:'join_institution'},'scripted-fixture');t.apply(ivo,{kind:'practice_skill',id},'scripted-fixture');await t.tick();
// Missing materials causes a measured failure, rather than an invented success.
ivo.inventory=[];t.apply(ivo,{kind:'practice_skill',id},'scripted-fixture');await t.tick();
const data={source:'scripted-fixture',island:t.name,day:t.day,stories:t.evolution,institutions:[...t.places.values()].filter(p=>p.institution).map(p=>({place:p.id,...p.institution})),skills:[...t.agents.values()].flatMap(a=>(a.skills??[]).map(s=>({id:s.id,name:s.recipe.name,goal:s.recipe.goal,agent:a.id,agentName:a.persona.name,origin:s.origin,learnedFrom:s.learnedFrom??null,attempts:s.attempts,successes:s.successes,evidence:s.evidence})))};
writeFileSync('apps/web/public/evolution-demo.json',JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({source:data.source,stories:data.stories.length,successes:data.skills.reduce((n,s)=>n+s.successes,0)}));

}
void main().catch(e=>{console.error(e);process.exitCode=1;});
