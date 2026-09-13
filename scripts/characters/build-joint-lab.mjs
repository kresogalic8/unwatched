// Isolated study: bind to measured image landmarks, preserve source pixels.
import {mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
const out='apps/web/public/characters/joint-lab';mkdirSync(out,{recursive:true});
const width=599,height=2365;
const points={shoulder:[230,55],elbow:[342,870],wrist:[360,1710],fingers:[320,2310]};
const origin=points.shoulder;
const world=([x,y])=>[x-origin[0],origin[1]-y];
const angle=(a,b)=>Math.atan2(a[1]-b[1],b[0]-a[0]);
const upperAngle=angle(points.shoulder,points.elbow),foreAngle=angle(points.elbow,points.wrist),handAngle=angle(points.wrist,points.fingers);
const distance=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const upperLength=distance(points.shoulder,points.elbow),foreLength=distance(points.elbow,points.wrist);
const deg=n=>n*180/Math.PI;
const bones=[{name:'root'},{name:'upper',parent:'root',length:upperLength,rotation:deg(upperAngle)},{name:'fore',parent:'upper',x:upperLength,length:foreLength,rotation:deg(foreAngle-upperAngle)},{name:'hand',parent:'fore',x:foreLength,length:600,rotation:deg(handAngle-foreAngle)},{name:'elbow-support',parent:'upper',x:upperLength,rotation:deg((foreAngle-upperAngle)/2)}];
const transforms={upper:[world(points.shoulder),upperAngle],fore:[world(points.elbow),foreAngle],hand:[world(points.wrist),handAngle],'elbow-support':[world(points.elbow),(upperAngle+foreAngle)/2]};
const smooth=n=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
function attachment(corrective){
 const vertices=[],uvs=[],triangles=[],reference=[];
 // Densify around the sleeve fold, elbow and wrist; keep finger region rigid.
 const rows=[0,160,400,650,770,825,870,915,970,1120,1400,1590,1650,1710,1770,1850,2100,2365];
 const columns=[0,.2,.4,.6,.8,1];
 rows.forEach((y,r)=>columns.forEach((u,c)=>{
  const p=world([u*width,y]);uvs.push(u,y/height);reference.push(...p);
  let weights;
  if(y>1590){const t=smooth((y-1590)/240);weights=[['fore',1-t],['hand',t]];}
  else if(corrective&&y>=770&&y<=970){const t=smooth(Math.abs(y-870)/100);weights=[['elbow-support',1-t],[y<870?'upper':'fore',t]];}
  else{const t=smooth((y-770)/200);weights=[['upper',1-t],['fore',t]];}
  weights=weights.filter(([,w])=>w>0);vertices.push(weights.length);
  for(const [name,w] of weights){const [pos,a]=transforms[name],dx=p[0]-pos[0],dy=p[1]-pos[1];vertices.push(bones.findIndex(b=>b.name===name),Math.cos(a)*dx+Math.sin(a)*dy,-Math.sin(a)*dx+Math.cos(a)*dy,w);}
  if(r&&c){const n=r*columns.length+c;triangles.push(n-7,n-6,n-1,n-6,n,n-1);}
 }));
 return {mesh:{type:'mesh',path:'arm',uvs,triangles,vertices},reference};
}
const plain=attachment(false),supported=attachment(true);
const data={skeleton:{spine:'4.2.0',images:'./'},bones,slots:[{name:'arm',bone:'upper',attachment:'arm'}],skins:[{name:'plain',attachments:{arm:{arm:plain.mesh}}},{name:'supported',attachments:{arm:{arm:supported.mesh}}}],animations:{}};
writeFileSync(`${out}/arm.json`,JSON.stringify(data,null,2)+'\n');
writeFileSync(`${out}/landmarks.json`,JSON.stringify({width,height,points,reference:plain.reference},null,2)+'\n');
writeFileSync(`${out}/arm.atlas`,`arm.png\nsize: ${width},${height}\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\narm\n  rotate: false\n  xy: 0,0\n  size: ${width},${height}\n  orig: ${width},${height}\n  offset: 0,0\n  index: -1\n`);
copyFileSync('apps/web/public/characters/mara-painted/unified/wave.png',`${out}/arm.png`);
