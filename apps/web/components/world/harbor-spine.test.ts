import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe,it,expect } from "vitest";
import { TextureAtlas,AtlasAttachmentLoader,SkeletonJson,Skeleton,AnimationStateData,AnimationState,Physics,MeshAttachment } from "@esotericsoftware/spine-pixi-v8";
describe.each([
 {folder:"harbor-spine",file:"harbor",skin:"mara-front",count:9},
 {folder:"mara-painted",file:"mara",skin:"mara-painted",count:1},
 {folder:"mara-arm-candidate",file:"mara",skin:"mara-painted",count:1},
])("$folder Spine assets",({folder:assetFolder,file,skin:skinName,count})=>{
 const folder=resolve(process.cwd(),"public/characters",assetFolder);
 const json=JSON.parse(readFileSync(`${folder}/${file}.json`,"utf8"));
 const atlas=new TextureAtlas(readFileSync(`${folder}/${file}.atlas`,"utf8"));
 const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(json);
 it("loads every view and appearance without missing regions",()=>{
  expect(data.skins).toHaveLength(count);
  for(const skin of data.skins){const skeleton=new Skeleton(data);skeleton.setSkin(skin);skeleton.setSlotsToSetupPose();for(const slot of skeleton.slots)expect(slot.getAttachment(),skin.name+"/"+slot.data.name).not.toBeNull();}
 });
 if((assetFolder==="mara-painted"||assetFolder==="mara-arm-candidate")){
  it("uses distinct opposite-hand artwork",()=>{
   const skeleton=new Skeleton(data);skeleton.setSkinByName(skinName);skeleton.setSlotsToSetupPose();
   const far=skeleton.findSlot("arm-art-far")!.getAttachment() as MeshAttachment;
   const near=skeleton.findSlot("arm-art-near")!.getAttachment() as MeshAttachment;
   expect(far.path).toBe("continuous/arm-near");
   expect(near.path).toBe("continuous/arm-far-clean");
  });
  it("anchors both upper leg seams to the pelvis throughout the stride",()=>{
   const skeleton=new Skeleton(data);skeleton.setSkinByName(skinName);skeleton.setSlotsToSetupPose();
   const state=new AnimationState(new AnimationStateData(data));state.setAnimation(0,"walk",true);
   const reference=new Map<string,number[]>();
   for(let frame=0;frame<144;frame++){
    state.update(1/120);state.apply(skeleton);
    for(const side of ["far","near"])skeleton.findIkConstraint("plant-"+side)!.mix=1;
    skeleton.updateWorldTransform(Physics.none);
    const hip=skeleton.findBone("hip")!,det=hip.a*hip.d-hip.b*hip.c;
    for(const side of ["far","near"]){
     const slot=skeleton.findSlot("leg-"+side)!,mesh=slot.getAttachment() as MeshAttachment;
     const vertices=new Float32Array(8);mesh.computeWorldVertices(slot,0,8,vertices,0,2);
     const local=[];for(let i=0;i<8;i+=2){const x=vertices[i]!-hip.worldX,y=vertices[i+1]!-hip.worldY;local.push((hip.d*x-hip.b*y)/det,(-hip.c*x+hip.a*y)/det);}
     if(!reference.has(side))reference.set(side,local);
     for(let i=0;i<8;i++)expect(local[i]).toBeCloseTo(reference.get(side)![i]!,4);
    }
   }
  });
 }
 it("keeps every bone finite through every exported motion",()=>{
  for(const animation of data.animations){const skeleton=new Skeleton(data);skeleton.setSkinByName(skinName);skeleton.setSlotsToSetupPose();const state=new AnimationState(new AnimationStateData(data));state.setAnimation(0,animation.name,true);
   for(let i=0;i<90;i++){state.update(1/30);state.apply(skeleton);skeleton.updateWorldTransform(Physics.none);for(const slot of skeleton.slots){const attachment=slot.getAttachment();if(attachment instanceof MeshAttachment){const vertices=new Float32Array(attachment.worldVerticesLength);attachment.computeWorldVertices(slot,0,vertices.length,vertices,0,2);expect([...vertices].every(Number.isFinite)).toBe(true);}}for(const b of skeleton.bones){expect(Number.isFinite(b.worldX)).toBe(true);expect(Number.isFinite(b.worldY)).toBe(true);}}
  }
 });
 it("reaches the same handoff point throughout the offering animation",()=>{
  const skeleton=new Skeleton(data);skeleton.setSkinByName(skinName);const state=new AnimationState(new AnimationStateData(data));state.setAnimation(0,"offer",true);
  for(let i=0;i<60;i++){state.update(1/30);state.apply(skeleton);skeleton.findIkConstraint("reach")!.mix=1;const target=skeleton.findBone("hand-target")!;target.x=25;target.y=51;skeleton.updateWorldTransform(Physics.none);const hand=skeleton.findBone("hand-near")!;expect(Math.hypot(hand.worldX-target.worldX,hand.worldY-target.worldY)).toBeLessThan(.02);}
 });
 it("keeps the supporting foot on its independent ground target while walking",()=>{
  const skeleton=new Skeleton(data);const state=new AnimationState(new AnimationStateData(data));state.setAnimation(0,"walk",true);
  for(let i=0;i<72;i++){state.update(1/60);state.apply(skeleton);for(const side of ["far","near"])skeleton.findIkConstraint("plant-"+side)!.mix=1;skeleton.updateWorldTransform(Physics.none);
   if((assetFolder==="mara-painted"||assetFolder==="mara-arm-candidate"))for(const side of ["far","near"]){
    const hip=skeleton.findBone("thigh-"+side)!,knee=skeleton.findBone("shin-"+side)!,foot=skeleton.findBone("foot-"+side)!;
    // A grounded support leg must extend rather than remain in a crouch.
    const target=skeleton.findBone("foot-target-"+side)!;
    if(Math.abs(target.worldY-1)<.01)expect(Math.hypot(foot.worldX-hip.worldX,foot.worldY-hip.worldY)).toBeGreaterThan(33);
    // Forward-facing knees stay to the right of the hip-to-ankle line.
    const t=(knee.worldY-hip.worldY)/(foot.worldY-hip.worldY);
    expect(knee.worldX-(hip.worldX+(foot.worldX-hip.worldX)*t)).toBeGreaterThanOrEqual(-.01);
   }
   if((assetFolder==="mara-painted"||assetFolder==="mara-arm-candidate"))expect(skeleton.findBone("foot-near")!.worldX-skeleton.findBone("foot-far")!.worldX).toBeGreaterThan(.9);
   const heights=[];for(const side of ["far","near"]){const foot=skeleton.findBone("foot-"+side)!,target=skeleton.findBone("foot-target-"+side)!;expect(Math.hypot(foot.worldX-target.worldX,foot.worldY-target.worldY)).toBeLessThan(.05);heights.push(Math.abs(foot.worldY));}
   expect(Math.min(...heights)).toBeCloseTo(1,1);
  }
 });
});
