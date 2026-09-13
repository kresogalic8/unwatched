import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,it,expect} from 'vitest';
import {TextureAtlas,AtlasAttachmentLoader,SkeletonJson,Skeleton,Physics,MeshAttachment} from '@esotericsoftware/spine-pixi-v8';
const folder=resolve(process.cwd(),'public/characters/joint-lab');
const data=new SkeletonJson(new AtlasAttachmentLoader(new TextureAtlas(readFileSync(`${folder}/arm.atlas`,'utf8')))).readSkeletonData(JSON.parse(readFileSync(`${folder}/arm.json`,'utf8')));
const reference=JSON.parse(readFileSync(`${folder}/landmarks.json`,'utf8')).reference as number[];
describe('source-calibrated joint study',()=>{
 it.each(['plain','supported'])('%s reproduces source coordinates in rest pose',skin=>{
  const s=new Skeleton(data);s.setSkinByName(skin);s.setToSetupPose();s.updateWorldTransform(Physics.none);
  const slot=s.findSlot('arm')!,mesh=slot.getAttachment() as MeshAttachment,vertices=new Float32Array(mesh.worldVerticesLength);mesh.computeWorldVertices(slot,0,vertices.length,vertices,0,2);
  vertices.forEach((v,i)=>expect(Math.abs(v-reference[i]!*(i%2===1&&Skeleton.yDown?-1:1))).toBeLessThan(.002));
 });
 it('keeps supported elbow row volume through the inspection range',()=>{
  const s=new Skeleton(data);s.setSkinByName('supported');s.setToSetupPose();let restWidth=0;
  for(const angle of [0,45,90,120]){
   s.setToSetupPose();s.findBone('fore')!.rotation+=angle;s.findBone('elbow-support')!.rotation+=angle/2;s.updateWorldTransform(Physics.none);
   const slot=s.findSlot('arm')!,mesh=slot.getAttachment() as MeshAttachment,vertices=new Float32Array(mesh.worldVerticesLength);mesh.computeWorldVertices(slot,0,vertices.length,vertices,0,2);
   expect([...vertices].every(Number.isFinite)).toBe(true);
   const start=6*6*2,end=start+5*2;const width=Math.hypot(vertices[end]!-vertices[start]!,vertices[end+1]!-vertices[start+1]!);
   if(angle===0)restWidth=width;else expect(Math.abs(width-restWidth)).toBeLessThan(.002);
  }
 });
});

it('preserves V4 body identity outside the explicit rig corrections',()=>{
 const base=JSON.parse(readFileSync(resolve(folder,'../mara-painted/mara.json'),'utf8'));
 const candidate=JSON.parse(readFileSync(resolve(folder,'../mara-arm-candidate/mara.json'),'utf8'));
 expect(candidate.bones.slice(0,base.bones.length).filter((b:{name:string})=>b.name!=="head")).toEqual(base.bones.filter((b:{name:string})=>b.name!=="head"));
 for(const [slot,art] of Object.entries(base.skins[0].attachments).filter(([slot])=>slot!=="face"&&!slot.startsWith("leg-")))expect(candidate.skins[0].attachments[slot]).toEqual(art);
 for(const [name,animation] of Object.entries(base.animations) as [string,{bones:Record<string,unknown>}][])for(const [bone,keys] of Object.entries(animation.bones).filter(([bone])=>!(name==="walk"&&bone==="hip")))expect(candidate.animations[name].bones[bone]).toEqual(keys);
});
