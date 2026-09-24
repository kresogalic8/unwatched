import {BlueprintSpec, type Action, type CitizenBlueprint} from '@unwatched/protocol';
import type {AgentState} from './types.ts';
import {sha256} from './hash.ts';
/** Costs and effects belong to the engine, never to generated prose. */
export function blueprintMaterials(spec:CitizenBlueprint['spec']):string[]{
 return spec.modules.flatMap(m=>m==='carry'?['timber','rope','rope']:['timber','stone']);
}
export function blueprintId(spec:CitizenBlueprint['spec'],author:string,parent?:string){return sha256(JSON.stringify({author,parent:parent??null,name:spec.name,purpose:spec.purpose,modules:[...spec.modules].sort()})).slice(0,20);}
export function blueprintVerdict(a:AgentState,action:Action):string|null{
 const designs=a.blueprints??[];
 if(action.kind==='design_item'){
  if(!BlueprintSpec.safeParse(action.spec).success)return 'invalid blueprint; choose distinct carry or repair modules';
  if(designs.length>=8)return 'at most eight blueprint versions per citizen';
  if(action.parent&&!designs.some(d=>d.id===action.parent))return 'revision must reference your existing blueprint';
  if(action.desire_id&&!a.desires?.some(d=>d.id===action.desire_id&&d.state==='active'))return 'link only an existing active desire';
  if(designs.some(d=>d.id===blueprintId(action.spec,a.id,action.parent)))return 'this blueprint version already exists';
 }
 if(action.kind==='prototype_item'||action.kind==='craft_design'){
  const d=designs.find(d=>d.id===action.blueprint);if(!d)return 'unknown personal blueprint';
  if(action.kind==='craft_design'&&!d.prototyped)return 'assemble a prototype before making another copy';
  if(action.kind==='prototype_item'&&d.prototyped)return 'prototype already assembled; use craft_design for another copy';
  const bag=[...a.inventory];for(const material of blueprintMaterials(d.spec)){const i=bag.indexOf(material);if(i<0)return `requires ${blueprintMaterials(d.spec).join(', ')}`;bag.splice(i,1);}
 }
 return null;
}
