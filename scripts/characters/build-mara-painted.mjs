// Original Mara artwork, continuous meshes. The official Spineboy example is
// a construction reference only; no sample artwork or animation data is copied.
import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
const out='apps/web/public/characters/mara-painted';
const data=JSON.parse(readFileSync('apps/web/public/characters/harbor-spine/harbor.json','utf8'));
const oldRegions=JSON.parse(readFileSync(`${out}/images/regions.json`,'utf8'));
const regions=JSON.parse(readFileSync(`${out}/continuous/regions.json`,'utf8'));
// Crop the opposite arm below the neighbouring shoe in the generated sheet.
regions['arm-far-clean']={x:regions['arm-far'].x+42,y:regions['arm-far'].y+84,width:114,height:540};
let atlas='mara.png\nsize: 2560,2048\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\n';
for(const [name,r] of Object.entries(oldRegions))atlas+=`${name}\n  rotate: false\n  xy: ${r.x},${r.y}\n  size: ${r.width},${r.height}\n  orig: ${r.width},${r.height}\n  offset: 0,0\n  index: -1\n`;
atlas+='\ncontinuous.png\nsize: 3072,2048\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\n';
for(const [name,r] of Object.entries(regions))atlas+=`continuous/${name}\n  rotate: false\n  xy: ${r.x},${r.y}\n  size: ${r.width},${r.height}\n  orig: ${r.width},${r.height}\n  offset: 0,0\n  index: -1\n`;
copyFileSync(`${out}/images/mara.png`,`${out}/mara.png`);
copyFileSync(`${out}/continuous/continuous.png`,`${out}/continuous.png`);
atlas+='\nwave-hand.png\nsize: 1024,1024\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\nwave-palm\n  rotate: false\n  xy: 260,260\n  size: 444,646\n  orig: 444,646\n  offset: 0,0\n  index: -1\n';
copyFileSync(`${out}/continuous/wave-hand-source.png`,`${out}/wave-hand.png`);
writeFileSync(`${out}/mara.atlas`,atlas);
const bone=name=>data.bones.find(b=>b.name===name);
const idx=name=>data.bones.findIndex(b=>b.name===name);
bone('neck').y=29;bone('head').y=10.6;
for(const side of ['far','near']){
 const x=side==='far'?-3.5:3.5;
 bone('thigh-'+side).x=x;bone('foot-target-'+side).x=x;
 bone('arm-'+side).x=side==='far'?-6.5:7;bone('arm-'+side).y=25;
 data.ik.find(c=>c.name==='plant-'+side).bendPositive=false;
}
const smooth=x=>{const t=Math.min(1,Math.max(0,x));return t*t*(3-2*t);};
const attachments={};
// Each surface is one uninterrupted texture. Four columns preserve volume at
// the bend; successive rows smoothly transfer influence between adjacent bones.
function mesh(slot,path,rows,weights,point){
 const vertices=[],uvs=[],triangles=[];const columns=[0,.33,.67,1];
 rows.forEach((row,r)=>columns.forEach((u,c)=>{
  let v=row.v;
  if(slot==='body'&&r===0&&c>0&&c<3)v=.082;
  const sampleU=u;
  uvs.push(sampleU,v);const influences=weights(row,u);vertices.push(influences.length);
  for(const [name,weight] of influences){const [x,y]=point(row,sampleU,name);vertices.push(idx(name),x,y,weight);}
  if(r&&c){const n=r*4+c;triangles.push(n-5,n-4,n-1,n-4,n,n-1);}
 }));
 attachments[slot]={[slot]:{type:'mesh',path,uvs,triangles,vertices}};
}
for(const side of ['far','near']){
 const thigh='thigh-'+side,shin='shin-'+side,foot='foot-'+side;
 const rows=[[-4,.08],[0,.13],[2,.17],[5,.22],[7,.26],[12,.36],[14,.42],[16,.47],[18,.53],[20,.59],[25,.73],[29,.84],[31,.88],[33,.92],[35,1]].map(([depth,v])=>({depth,v}));
 mesh('leg-'+side,'continuous/leg-far',rows,r=>{
  const root=smooth((r.depth-1)/7);
  if(root===0)return [['hip',1]];
  if(root<1)return [['hip',1-root],[thigh,root]];
  const knee=smooth((r.depth-13)/7),ankle=smooth((r.depth-29)/4);
  if(ankle===1)return [[foot,1]];
  if(ankle>0)return [[shin,1-ankle],[foot,ankle]];
  if(knee===0)return [[thigh,1]];
  if(knee===1)return [[shin,1]];
  return [[thigh,1-knee],[shin,knee]];
 },(r,u,name)=>{const lateral=(u-.32)*(8+4*smooth((r.depth+4)/9)-2*smooth((r.depth-5)/5));if(name==='hip')return [bone(thigh).x+lateral,-r.depth];return name===foot?[lateral,34-r.depth]:[r.depth-(name===shin?17:0),lateral];});
 const upper='arm-'+side,fore='fore-'+side,hand='hand-'+side;
 const armRows=[[-2,0],[2,.12],[7,.27],[11,.39],[13,.44],[15,.49],[18,.59],[23,.74],[25,.8],[27,.87],[30,1]].map(([depth,v])=>({depth,v}));
 mesh('arm-art-'+side,side==='far'?'continuous/arm-near':'continuous/arm-far-clean',armRows,r=>{
  const elbow=smooth((r.depth-11)/5),wrist=smooth((r.depth-24)/4);
  if(wrist===1)return [[hand,1]];
  if(wrist>0)return [[fore,1-wrist],[hand,wrist]];
  if(elbow===0)return [[upper,1]];
  if(elbow===1)return [[fore,1]];
  return [[upper,1-elbow],[fore,elbow]];
 },(r,u,name)=>[r.depth-(name===fore?14:name===hand?26:0),(u-.5)*6.1]);
}
const waveArm=structuredClone(attachments['arm-art-near']['arm-art-near']);
const waveVertexCount=8*4;
waveArm.uvs=waveArm.uvs.slice(0,waveVertexCount*2);
let offset=0;for(let i=0;i<waveVertexCount;i++)offset+=1+waveArm.vertices[offset]*4;
waveArm.vertices=waveArm.vertices.slice(0,offset);
waveArm.triangles=waveArm.triangles.filter((_,i,a)=>{const start=i-i%3;return a.slice(start,start+3).every(v=>v<waveVertexCount);});
attachments['arm-art-near']['wave-arm']=waveArm;
mesh('wave-hand','wave-palm',[0,.08,.2,.45,.7,1].map(v=>({v})),r=>{
 const hand=smooth(r.v/.22);return hand===0?[['fore-near',1]]:hand===1?[['hand-near',1]]:[['fore-near',1-hand],['hand-near',hand]];
},(r,u,name)=>[.67+(r.v-.5)*8.34+(name==='fore-near'?12:0),-.93+(u-.5)*6.1]);
const bodyRows=[{v:0,y:33},{v:.18,y:25},{v:.4,y:15},{v:.57,y:5},{v:.68,y:0},{v:.77,y:-2},{v:.86,y:-5}];
mesh('body','continuous/body',bodyRows,(r,u)=>{
 if(r.y>=5)return [['torso',1]];
 const follow=smooth(-r.y/7)*Math.abs(u-.5)*2;
 const thigh=u<.5?'thigh-far':'thigh-near';
 return follow>0?[['hip',1-follow],[thigh,follow]]:[['hip',1]];
},(r,u,name)=>{
 const x=(u-.5)*17;
 const y=r.v===0&&u>0&&u<1?29.35:r.y;
 return name.startsWith('thigh-')?[-r.y,x-bone(name).x]:[x,y];
});
for(const name of ['neutral','smile','blink','talk']){
 const vertices=[],uvs=[],triangles=[];
 const rows=[0,.4,.7,.8,.9,1];
 rows.forEach((v,r)=>[0,.33,.67,1].forEach((u,c)=>{
  const taper=smooth((v-.78)/.22),sampleU=u*(1-.66*taper)+.39*taper;
  uvs.push(sampleU,v);vertices.push(1,idx('head'),.3+(sampleU-.5)*18,8.5-v*19-3*smooth((v-.72)/.28),1);
  if(r&&c){const n=r*4+c;triangles.push(n-5,n-4,n-1,n-4,n,n-1);}
 }));
 (attachments.face??={})[name]={type:'mesh',path:name,uvs,triangles,vertices};
}
data.slots=[
 {name:'leg-far',bone:'thigh-far',attachment:'leg-far',color:'d1d9d5ff'},
 {name:'leg-near',bone:'thigh-near',attachment:'leg-near'},
 {name:'arm-art-near',bone:'arm-near',attachment:'arm-art-near'},
 {name:'face',bone:'head',attachment:'neutral'},
 {name:'body',bone:'torso',attachment:'body'},
 {name:'arm-art-far',bone:'arm-far',attachment:'arm-art-far'},
 {name:'wave-hand',bone:'hand-near',attachment:'wave-hand',color:'ffffff00'},
];
data.skins=[{name:'mara-painted',attachments}];
for(const animation of Object.values(data.animations)){delete animation.slots;for(const name of ['eyes','brows','mouth','hair'])delete animation.bones[name];}
const rotate=values=>values.map(([time,value])=>({time,value}));
// Contact, recoil, passing and push-off: complementary arms, stable head and
// a gentle weight transfer replace the symmetrical treadmill bounce.
const walk=data.animations.walk;walk.bones.hip={translate:[],rotate:[]};
for(const side of ['far','near']){
 const keys=[],roll=[];
 for(let i=0;i<=48;i++){
  const time=i/40,p=(i/48+(side==='far'?.5:0))%1;
  let x,y,angle;
  if(p<.6){const t=p/.6;x=3-6*t;y=0;angle=t<.2?8*(1-t/.2):t>.8?-12*smooth((t-.8)/.2):0;}
  else{const t=(p-.6)/.4;x=-3+6*smooth(t);y=2.6*Math.sin(Math.PI*t);angle=-12+20*smooth(t);}
  keys.push({time,x,y});roll.push({time,value:angle});
 }
 walk.bones['foot-target-'+side]={translate:keys};walk.bones['foot-'+side]={rotate:roll};
 const sign=side==='far'?1:-1;
 walk.bones['arm-'+side]={rotate:rotate([[0,-sign*10],[.3,0],[.6,sign*10],[.9,0],[1.2,-sign*10]])};
 walk.bones['fore-'+side]={rotate:rotate([[0,8],[.3,12],[.6,8],[.9,5],[1.2,8]])};
}
// Solve pelvis height from the supporting leg's reach. This gives a tall
// passing pose and a lower contact pose instead of holding both knees bent.
for(let i=0;i<=48;i++){
 const time=i/40,phase=i/48*Math.PI*2,angle=2*Math.sin(phase),radians=angle*Math.PI/180;
 const x=.65*Math.sin(phase);let height=Infinity;
 for(const side of ['far','near']){
  const p=(i/48+(side==='far'?.5:0))%1;
  if(p>=.6)continue;
  const localX=bone('thigh-'+side).x;
  const target=walk.bones['foot-target-'+side].translate[i];
  const dx=localX+target.x-(x+Math.cos(radians)*localX);
  height=Math.min(height,1+Math.sqrt(34*34-dx*dx)-Math.sin(radians)*localX-.12);
 }
 walk.bones.hip.translate.push({time,x,y:height-35});
 walk.bones.hip.rotate.push({time,value:angle});
}
walk.bones.torso={rotate:rotate([[0,0],[.3,-2.8],[.6,0],[.9,2.8],[1.2,0]])};
walk.bones.head={rotate:rotate([[0,.5],[.3,.8],[.6,.5],[.9,-.8],[1.2,.5]])};
// Keep hand gestures within the painted three-quarter view's readable range.
for(const name of ['wave','talk','offer'])for(const key of data.animations[name].bones['arm-near'].rotate)key.value*=.85;
data.animations.wave.bones['arm-near']={rotate:rotate([[0,10],[.4,100],[1.6,100],[2,10]])};
data.animations.wave.bones['fore-near']={rotate:rotate([[0,8],[.4,75],[.7,85],[1,75],[1.3,85],[1.6,75],[2,8]])};
data.animations.wave.bones['hand-near']={rotate:rotate([[0,0],[.4,0],[.65,-10],[.9,10],[1.15,-10],[1.4,10],[1.65,0],[2,0]])};
for(const key of data.animations.sit.bones.hip.translate)key.y=-17;
data.skeleton.images='./images/';
writeFileSync(`${out}/mara.json`,JSON.stringify(data,null,2)+'\n');
writeFileSync(`${out}/manifest.json`,JSON.stringify({version:4,character:'Mara',sourceJob:'6d960d0a-777e-4009-9727-af0289cb3702',artDirectionJob:'a3052794-c1ba-419b-89a7-be619bc228dc',construction:'Continuous weighted arm, leg and torso meshes; original animation curves',view:'three-quarter right',limitations:['Facial expressions use painted head attachments.','Local review only; additional directions are not authored.'],generator:'scripts/characters/build-mara-painted.mjs'},null,2)+'\n');
