// Arm-only candidate. V4 is input and is never overwritten.
import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from 'node:fs';
const source='apps/web/public/characters/mara-painted',out='apps/web/public/characters/mara-arm-candidate';mkdirSync(out,{recursive:true});
const data=JSON.parse(readFileSync(`${source}/mara.json`,'utf8'));
const lab=JSON.parse(readFileSync('apps/web/public/characters/joint-lab/arm.json','utf8'));
const names={upper:'cal-upper',fore:'cal-fore',hand:'cal-hand','elbow-support':'cal-elbow'};
for(const b of lab.bones.slice(1)){
 const next={...b,name:names[b.name],parent:b.parent==='root'?'torso':names[b.parent]};
 if(b.name==='upper')Object.assign(next,{x:7,y:25,scaleX:.013,scaleY:.013});
 data.bones.push(next);
}
const mesh=structuredClone(lab.skins.find(s=>s.name==='supported').attachments.arm.arm);mesh.path='cal-arm';
for(let i=0;i<mesh.vertices.length;){const count=mesh.vertices[i++];for(let j=0;j<count;j++){mesh.vertices[i]=data.bones.findIndex(b=>b.name===names[lab.bones[mesh.vertices[i]].name]);i+=4;}}
data.skins[0].attachments['cal-arm']={'cal-arm':mesh};
const bodyIndex=data.slots.findIndex(s=>s.name==='body');data.slots.splice(bodyIndex,0,{name:'cal-arm',bone:'cal-upper',attachment:'cal-arm',color:'ffffff00'});
for(const animation of Object.values(data.animations))for(const [to,from] of [['cal-upper','arm-near'],['cal-fore','fore-near'],['cal-hand','hand-near']])if(animation.bones[from]?.rotate)animation.bones[to]={rotate:structuredClone(animation.bones[from].rotate)};
// Head: use the original opaque neck extension and let the collar occlude it.
// Shorten only the stretched lower neck, preserving all facial UVs.
const head=data.bones.find(b=>b.name==='head');head.y-=.65;
for(const face of Object.values(data.skins[0].attachments.face)){
 for(let i=0,vertex=0;i<face.vertices.length;vertex++){
  const count=face.vertices[i++],v=face.uvs[vertex*2+1];
  const trim=v>=.8&&vertex%4===3;
  if(trim)face.uvs[vertex*2]=.70-.15*(v-.8);
  const t=Math.max(0,Math.min(1,(v-.72)/.28)),correction=1.5*t*t*(3-2*t);
  for(let n=0;n<count;n++){face.vertices[i+2]+=correction;if(trim)face.vertices[i+1]=.3+(face.uvs[vertex*2]-.5)*18;i+=4;}
 }
}
// Allow a small shoulder rise with the arm instead of pinning sleeve pixels
// to a stationary torso, which folds the cap in the raised pose.
data.animations.wave.bones['cal-upper'].translate=[{time:0,x:0,y:0},{time:.4,x:.15,y:.65},{time:1.6,x:.15,y:.65},{time:2,x:0,y:0}];
// Remove the artificial width bulge between pelvis anchor and upper thigh.
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const depths=[-4,0,2,5,7,12,14,16,18,20,25,29,31,33,35];
for(const side of ['far','near']){
 const leg=data.skins[0].attachments['leg-'+side]['leg-'+side];
 for(let i=0,v=0;i<leg.vertices.length;v++){
  const depth=depths[Math.floor(v/4)],oldWidth=8+4*ease((depth+4)/9)-2*ease((depth-5)/5),newWidth=8+2*ease((depth+4)/9),ratio=newWidth/oldWidth;
  const count=leg.vertices[i++];
  for(let n=0;n<count;n++){
   const b=data.bones[leg.vertices[i]];
   if(b.name==='hip'){const anchor=data.bones.find(b=>b.name==='thigh-'+side).x;leg.vertices[i+1]=anchor+(leg.vertices[i+1]-anchor)*ratio;}
   else if(b.name==='foot-'+side)leg.vertices[i+1]*=ratio;
   else leg.vertices[i+2]*=ratio;
   i+=4;
  }
 }
}
// Broader weight transfer, slightly softer support knee, and counter-rotation.
const walk=data.animations.walk;
for(let i=0;i<walk.bones.hip.translate.length;i++){
 const phase=i/48*Math.PI*2,angle=2.4*Math.sin(phase),radians=angle*Math.PI/180,x=1.25*Math.sin(phase);
 let height=Infinity;
 for(const side of ['far','near']){
  const p=(i/48+(side==='far'?.5:0))%1;if(p>=.6)continue;
  const localX=data.bones.find(b=>b.name==='thigh-'+side).x,target=walk.bones['foot-target-'+side].translate[i];
  const dx=localX+target.x-(x+Math.cos(radians)*localX);
  height=Math.min(height,1+Math.sqrt(34*34-dx*dx)-Math.sin(radians)*localX-.24);
 }
 Object.assign(walk.bones.hip.translate[i],{x,y:height-35});walk.bones.hip.rotate[i].value=angle;
}
// Retain anchored upper-leg roots; the trouser overlap moves with the pelvis.
writeFileSync(`${out}/mara.json`,JSON.stringify(data,null,2)+'\n');
const atlas=readFileSync(`${source}/mara.atlas`,'utf8')+'\ncal-arm.png\nsize: 599,2365\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\ncal-arm\n  rotate: false\n  xy: 0,0\n  size: 599,2365\n  orig: 599,2365\n  offset: 0,0\n  index: -1\n';
writeFileSync(`${out}/mara.atlas`,atlas);
for(const f of ['mara.png','continuous.png','wave-hand.png'])copyFileSync(`${source}/${f}`,`${out}/${f}`);
copyFileSync(`${source}/images/unfeathered-mara.png`,`${out}/mara.png`);
copyFileSync('apps/web/public/characters/joint-lab/arm.png',`${out}/cal-arm.png`);
writeFileSync(`${out}/manifest.json`,JSON.stringify({status:'isolated full-rig candidate',base:'Mara V4',changed:'Calibrated wave arm, shoulder rise, opaque shortened neck overlap, tapered upper thighs, wider pelvic weight transfer',uniformScale:.013,source:'joint-lab/arm.json',limitations:['Shoulder placement is a manual fit.','Generated arm color is not guaranteed to match the original shirt.','This is not a replacement for the accepted character.']},null,2)+'\n');
