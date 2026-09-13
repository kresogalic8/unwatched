import { createRequire } from 'node:module';
import { mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const require=createRequire(resolve('apps/web/package.json'));
const {Resvg}=require('@resvg/resvg-js');
const out=resolve('apps/web/public/characters/harbor-spine');mkdirSync(out+'/images',{recursive:true});
const ink='#4b5545';
const variants=[{id:'mara',skin:'#ba8462',shade:'#976445',shirt:'#eee6d1',seam:'#bbb49a',pants:'#526c66',hair:'#67503b'}, {id:'ivo',skin:'#d4a882',shade:'#b88863',shirt:'#a3b295',seam:'#7e9075',pants:'#485a54',hair:'#4b4639'}, {id:'elio',skin:'#e1b797',shade:'#b98b6c',shirt:'#688b82',seam:'#486e65',pants:'#c5ba99',hair:'#a07b42'}];
const images=[];const add=(name,art)=>{images.push({name,art});return name};
const path=(d,fill,stroke=ink,w=.45)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const ellipse=(x,y,rx,ry,fill)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
for(const v of variants){
 add(v.id+'/torso',path('M-9 -27 Q-5 -30 0 -28 Q5 -30 9 -27 L10 -3 Q1 1 -10 -3Z',v.shirt)+path('M-8 -25 Q-9 -12 -7 -4 L-4 -3 Q-7 -12 -5 -23Z',v.seam,'none')+path('M-4 -28 L0 -23 L4 -28', 'none',v.seam,.8)+path('M0 -23 L0 -4','none',v.seam,.4)+path('M4 -16 L8 -16 L7 -11 Q5 -10 4 -12Z','none',v.seam,.5)+[19,14,9].map(y=>ellipse(.5,-y,.65,.7,'#a57751')).join(''));
 add(v.id+'/hips',path('M-8 -3 Q0 -5 8 -3 L7 4 L-7 4Z',v.pants)+path('M-7 -2 L7 -2','none',ink,.45));
 add(v.id+'/thigh',path('M0 -3.7 Q8 -4.2 17 -3 L18 3 Q9 4.2 0 3.7Z',v.pants)+path('M2 2 Q10 3 15 2','none',ink,.45));
 add(v.id+'/shin',path('M0 -3 Q8 -3 17 -2.7 L17 2.7 L0 3Z',v.pants)+path('M14 -2.8 L14 2.8','none',v.seam,.65));
 add(v.id+'/upper',path('M-1 -4 Q6 -4.6 14 -3.2 L14 3.2 Q6 4.6 -1 4Z',v.shirt)+path('M2 2.5 Q8 3 12 2.5','none',v.seam,.65));
 add(v.id+'/fore',path('M-1 -3.2 L12 -2.7 L12 2.7 L-1 3.2Z',v.shirt)+path('M9 -2.8 L9 2.8','none',v.seam,.7));
 add(v.id+'/hand',path('M-1 -2.3 L3 -2.4 Q6 -2 6 0 L5 2 Q4 3 1 2 L-1 1.5Z',v.skin)+path('M1 -2 L2 -4 Q3 -4 3 -2','none',v.shade,.8));
 add(v.id+'/neck',path('M-2.8 4 L-2.8 -6 L3 -6 L3 4 Q0 6 -2.8 4Z',v.skin)+path('M-2.5 -2 Q0 1 2.8 -1 L2.8 1 Q0 3 -2.5 1Z',v.shade,'none'));
 add(v.id+'/face',path('M-6 -7 Q0 -12 6 -7 Q9 -4 7 3 Q5 10 0 10 Q-6 9 -7 3 Q-9 -3 -6 -7Z',v.skin)+path('M-6 -5 Q-6 6 2 9 Q-5 11 -7 3Z',v.shade,'none')+ellipse(4,3,2.2,2.7,'#e8bd96')+ellipse(-7.1,1,1.5,2.2,v.skin)+path('M-7 0 Q-5.8 0 -6.5 2','none',v.shade,.5));
 add(v.id+'/profile',path('M-6 -7 Q0 -11 6 -7 L6 -1 Q7 1 9 2 Q9 3 6 3 Q6 8 1 10 Q-5 9 -7 3Z',v.skin)+path('M-6 -5 Q-6 6 2 9 Q-5 11 -7 3Z',v.shade,'none')+ellipse(-5,1,1.5,2.2,v.skin));
 const hairstyles={mara:path('M-7 5 Q-12 -3 -7 -9 Q-3 -13 3 -10 Q9 -9 8 -3 L5 -5 Q1 -8 -4 -4 L-4 6Z',v.hair)+path('M-7 -4 Q-6 -10 0 -9 M-8 0 Q-7 -5 -4 -6','none','#927452',.65),ivo:path('M-7 1 L-8 -5 Q-6 -12 2 -10 Q7 -10 8 -4 L5 -4 L3 -7 Q0 -5 -5 -5 L-5 2Z',v.hair)+path('M-5 -7 L-1 -8 M0 -8 L4 -7','none','#80755d',.6),elio:path('M-7 2 Q-11 -6 -5 -9 Q-5 -12 0 -10 Q5 -12 7 -8 Q10 -6 7 -3 L4 -5 Q1 -4 -1 -6 L-5 -3 L-5 3Z',v.hair)+path('M-6 -6 Q-3 -9 0 -7 M1 -8 Q4 -10 6 -6','none','#c5a569',.65)};
 add(v.id+'/hair',hairstyles[v.id]);
 add(v.id+'/back',path('M-6 -7 Q0 -12 6 -7 Q9 -4 7 3 Q5 10 0 10 Q-6 9 -7 3 Q-9 -3 -6 -7Z',v.hair)+path('M-4 -5 Q-6 3 -2 6 M1 -7 Q-1 1 3 5','none',v.seam,.6));
 add(v.id+'/brow',path('M-2 0 Q0 -1 2 0','none',v.hair,.8));
 add(v.id+'/beard',v.id==='ivo'?path('M-6 3 Q-3 7 0 6 Q3 7 6 3 L5 7 Q0 12 -5 7Z',v.hair):'');
 add(v.id+'/glasses',v.id==='elio'?`<g fill="none" stroke="#5b624f" stroke-width=".55"><circle cx="-3.2" cy="0" r="2.4"/><circle cx="3.2" cy="0" r="2.4"/><path d="M-.8 0H.8"/></g>`:'');
}
add('shoe',path('M-3 -2 Q-2 -5 1 -3 L3 -1 L6 0 Q7 1 6 2 L-3 2Z','#77654b')+path('M-3 2H6','none','#464b3c',1)+path('M0 -2L2 -1','none','#c4b490',.6));
add('eye',ellipse(0,0,1.05,1.25,ink)+ellipse(-.25,-.35,.25,.3,'#f8f4e8'));
add('mouth-neutral',path('M-1.8 0 Q0 .9 1.8 0','none','#694e3d',.65));
add('mouth-smile',path('M-2.5 -.5 Q0 3 2.5 -.5','none','#694e3d',.75));
add('mouth-talk',ellipse(0,.5,1.8,1.25,'#694e3d'));
add('parcel',path('M-5 -3H5V4H-5Z','#c49863')+path('M0 -3V4 M-5 0H5','none','#eee2c5',.7));
// Each region retains the same transparent canvas and a documented origin.
const cell=256,cols=8,rows=Math.ceil(images.length/cols),width=cols*cell,height=rows*cell;
const svg=(art)=>`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="-32 -32 64 64">${art}</svg>`;
let atlas=`harbor.png\nsize: ${width},${height}\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\n`;
let sheet='';
images.forEach(({name,art},i)=>{const x=i%cols*cell,y=Math.floor(i/cols)*cell;mkdirSync(out+'/images/'+name.split('/').slice(0,-1).join('/'),{recursive:true});writeFileSync(out+'/images/'+name+'.svg',svg(art));writeFileSync(out+'/images/'+name+'.png',new Resvg(svg(art)).render().asPng());sheet+=`<svg x="${x}" y="${y}" width="256" height="256" viewBox="-32 -32 64 64">${art}</svg>`;atlas+=`${name}\n  rotate: false\n  xy: ${x},${y}\n  size: 256,256\n  orig: 256,256\n  offset: 0,0\n  index: -1\n`;});
writeFileSync(out+'/harbor.png',new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${sheet}</svg>`).render().asPng());writeFileSync(out+'/harbor.atlas',atlas);
const bones=[{name:'root'},{name:'hip',parent:'root',y:35},{name:'torso',parent:'hip'},{name:'neck',parent:'torso',y:31},{name:'head',parent:'neck',y:10},{name:'hair',parent:'head'},{name:'eyes',parent:'head',y:1},{name:'brows',parent:'head',y:4},{name:'mouth',parent:'head',x:1,y:-4}];
for(const [side,x] of [['far',-5],['near',5]]){
 bones.push({name:'thigh-'+side,parent:'hip',x,rotation:-90,length:17},{name:'shin-'+side,parent:'thigh-'+side,x:17,length:17},{name:'foot-'+side,parent:'shin-'+side,x:17,rotation:90});
 bones.push({name:'arm-'+side,parent:'torso',x:side==='far'?-9:9,y:26,rotation:-90,length:14},{name:'fore-'+side,parent:'arm-'+side,x:14,length:12},{name:'hand-'+side,parent:'fore-'+side,x:12});
}
bones.push({name:'hand-target',parent:'root',x:28,y:50});
const slots=[];const setup={};
const slot=(name,bone,part,x=0,y=0)=>{slots.push({name,bone,attachment:name});setup[name]={part,x,y};};
for(const side of ['far','near']){slot('thigh-'+side,'thigh-'+side,'thigh');slot('shin-'+side,'shin-'+side,'shin');slot('shoe-'+side,'foot-'+side,'shoe');}
slot('upper-far','arm-far','upper');slot('fore-far','fore-far','fore');slot('hand-far','hand-far','hand');slot('hips','hip','hips');slot('torso','torso','torso');slot('neck','neck','neck');slot('upper-near','arm-near','upper');slot('fore-near','fore-near','fore');slot('hand-near','hand-near','hand');slot('face','head','face');slot('beard','head','beard');slot('eye-far','eyes','eye',-3.2);slot('eye-near','eyes','eye',3.2);slot('brow-far','brows','brow',-3.2);slot('brow-near','brows','brow',3.2);slot('mouth','mouth','mouth-neutral');slot('glasses','eyes','glasses');slot('hair','hair','hair');
const shared=new Set(['shoe','eye','mouth-neutral']);
const skins=[];
for(const v of variants)for(const view of ['front','side','back']){
 const attachments={};for(const [name,a] of Object.entries(setup)){
  let part=a.part;if(view==='side'&&name==='face')part='profile';if(view==='back'&&name==='face')part='back';
  let scale=1;if(view==='back'&&['eye-far','eye-near','brow-far','brow-near','mouth','beard','glasses'].includes(name))scale=0;
  if(view==='side'&&['eye-far','brow-far','glasses'].includes(name))scale=0;
  attachments[name]={[name]:{path:shared.has(part)?part:v.id+'/'+part,width:64,height:64,x:a.x+(view==='side'&&['eye-near','brow-near'].includes(name)?1:0),y:a.y,scaleX:scale,scaleY:scale}};
  if(name==='mouth')for(const expression of ['smile','talk'])attachments[name][expression]={path:'mouth-'+expression,width:64,height:64,scaleX:scale,scaleY:scale};
 }
 skins.push({name:v.id+'-'+view,attachments});
}
const rot=(values)=>values.map(([time,value])=>({time,value}));
const trans=values=>values.map(([time,x,y])=>({time,x,y}));
const idle={bones:{torso:{rotate:rot([[0,-.7],[1,.7],[2,-.7]])},head:{rotate:rot([[0,1],[1,-1],[2,1]])},'fore-near':{rotate:rot([[0,7],[1,10],[2,7]])},hair:{rotate:rot([[0,-1],[1.1,1],[2,-1]])},eyes:{scale:[{x:1,y:1},{time:1.7,x:1,y:1},{time:1.77,x:1,y:.08},{time:1.85,x:1,y:1},{time:2,x:1,y:1}]}}};
const walk={bones:{hip:{translate:trans([[0,0,-.8],[.3,0,0],[.6,0,-.8],[.9,0,0],[1.2,0,-.8]])},torso:{rotate:rot([[0,1],[.6,-1],[1.2,1]])},head:{rotate:rot([[0,-1],[.6,1],[1.2,-1]])},hair:{rotate:rot([[0,-2],[.3,1],[.6,2],[.9,-1],[1.2,-2]])}}};
for(const [side,sign] of [['far',1],['near',-1]]){walk.bones['thigh-'+side]={rotate:rot([[0,sign*23],[.3,0],[.6,-sign*23],[.9,0],[1.2,sign*23]])};walk.bones['shin-'+side]={rotate:rot([[0,0],[.3,side==='far'?0:32],[.6,0],[.9,side==='far'?32:0],[1.2,0]])};walk.bones['foot-'+side]={rotate:rot([[0,-sign*23],[.3,side==='far'?0:-32],[.6,sign*23],[.9,side==='far'?-32:0],[1.2,-sign*23]])};walk.bones['arm-'+side]={rotate:rot([[0,-sign*16],[.6,sign*16],[1.2,-sign*16]])};walk.bones['fore-'+side]={rotate:rot([[0,8],[.6,16],[1.2,8]])};}
const wave={bones:{'arm-near':{rotate:rot([[0,10],[.4,125],[.8,130],[1.2,125],[1.6,130],[2,10]])},'fore-near':{rotate:rot([[0,8],[.4,32],[.65,12],[.9,36],[1.15,12],[1.4,36],[1.65,12],[2,8]])},head:{rotate:rot([[0,0],[.5,-5],[1.5,-5],[2,0]])}},slots:{mouth:{attachment:[{name:'smile'},{time:2,name:'mouth'}]}}};
const talk={bones:{'arm-near':{rotate:rot([[0,22],[.5,45],[1,27],[1.5,42],[2,22]])},'fore-near':{rotate:rot([[0,34],[.5,44],[1,25],[1.5,40],[2,34]])},head:{rotate:rot([[0,0],[.4,3],[.8,0],[1.4,-2],[2,0]])}},slots:{mouth:{attachment:[{name:'talk'},{time:.18,name:'mouth'},{time:.4,name:'talk'},{time:.65,name:'mouth'},{time:1,name:'talk'},{time:1.3,name:'smile'},{time:2,name:'mouth'}]}}};
const listen={bones:{head:{rotate:rot([[0,-3],[.5,1],[.8,-3],[1.2,-3],[1.5,1],[2,-3]])},'fore-near':{rotate:rot([[0,12],[2,12]])}}};
const offer={bones:{'arm-near':{rotate:rot([[0,0],[.5,45],[1.5,45],[2,0]])},'fore-near':{rotate:rot([[0,8],[.5,35],[1.5,35],[2,8]])},head:{rotate:rot([[0,0],[.7,5],[1.3,3],[2,0]])}}};
const sit={bones:{hip:{translate:trans([[0,0,-14],[2,0,-14]])},'thigh-far':{rotate:rot([[0,90],[2,90]])},'thigh-near':{rotate:rot([[0,90],[2,90]])},'shin-far':{rotate:rot([[0,-90],[2,-90]])},'shin-near':{rotate:rot([[0,-90],[2,-90]])},'arm-near':{rotate:rot([[0,35],[2,35]])},'fore-near':{rotate:rot([[0,30],[2,30]])}}};
// Feet use independent ground targets; shoes keep their orientation as knees bend.
for(const side of ['far','near']){
 const foot=bones.find(b=>b.name==='foot-'+side);foot.rotation=0;foot.inherit='onlyTranslation';
 const x=side==='far'?-5:5;bones.push({name:'foot-target-'+side,parent:'root',x,y:1});
 delete walk.bones['thigh-'+side];delete walk.bones['shin-'+side];delete walk.bones['foot-'+side];
 const samples=[];for(let i=0;i<=24;i++){const time=i/20;const phase=(time/1.2+(side==='far'?.5:0))%1;const offset=phase<.5?7-28*phase:-7+14*((phase-.5)*2);const lift=phase<.5?0:Math.sin((phase-.5)*Math.PI*2)*5;samples.push({time,x:offset,y:lift});}
 walk.bones['foot-target-'+side]={translate:samples};
}
walk.bones.hip={translate:trans([[0,0,-1.5],[.3,0,-2],[.6,0,-1.5],[.9,0,-2],[1.2,0,-1.5]])};
for(const anim of [idle,wave,talk,listen,offer])for(const timelines of Object.values(anim.bones))if(timelines.rotate){const keys=timelines.rotate;for(let i=0;i<keys.length-1;i++){const a=keys[i],b=keys[i+1],dt=b.time-a.time;a.curve=[a.time+dt*.35,a.value,a.time+dt*.65,b.value];}}
const data={skeleton:{spine:'4.2.22',width:64,height:86,fps:30,images:'./images/'},bones,slots,ik:[...['far','near'].map((side,i)=>({name:'plant-'+side,order:i,bones:['thigh-'+side,'shin-'+side],target:'foot-target-'+side,mix:0,bendPositive:false})),{name:'reach',order:2,bones:['arm-near','fore-near'],target:'hand-target',mix:0,bendPositive:true}],skins,animations:{idle,walk,wave,talk,listen,offer,sit}};
writeFileSync(out+'/harbor.json',JSON.stringify(data,null,2)+'\n');
writeFileSync(out+'/manifest.json',JSON.stringify({version:1,spine:'4.2',variants:variants.map(v=>v.id),views:['front','side','back'],animations:Object.keys(data.animations),artwork:'Original Unwatched harbor character parts',generator:'scripts/characters/build-harbor-spine.mjs'},null,2)+'\n');
console.log(`${images.length} original regions; ${bones.length} bones; ${skins.length} skins; ${Object.keys(data.animations).length} motions`);
