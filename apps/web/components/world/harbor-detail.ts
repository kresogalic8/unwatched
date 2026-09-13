import {Container, Graphics} from 'pixi.js';

type Place={id:string;x:number;y:number;sprite:string;kind:string};
type Point={x:number;y:number};
const random=(n:number)=>{let h=Math.imul(n+917,1597334677);h=Math.imul(h^(h>>>16),2246822507);return(h>>>0)/4294967296;};

/** A shared travelling breeze. Different materials respond to the same slow gust. */
export function harborBreeze(seconds:number,x:number,y:number,wind:number){
 const phase=seconds*.72-x*.0017-y*.0006;
 return wind*(.58+.28*Math.sin(phase)+.14*Math.sin(phase*.47+1.2));
}

/** Ground-only details: no new obstacles or elevation that could disagree with navigation. */
export function harborGround(places:Iterable<Place>,inside:(x:number,y:number)=>number){
 const list=[...places],harbor=list.find(p=>p.id==='harbor');
 const root=new Container(),stone=new Graphics(),wet=new Graphics();root.addChild(stone,wet);
 const puddles:Point[]=[];
 if(!harbor)return{root,update:(_wet:number,_time:number)=>{}};
 const near=list.filter(p=>p.kind!=='plot'&&!p.sprite.startsWith('look:')&&Math.hypot(p.x-harbor.x,p.y-harbor.y)<620&&/harbor|inn|boatshed|fishhouse|chandlery|bakery|shop|tavern/.test(p.sprite));
 for(const [index,p] of near.entries()){
  // Irregular limestone courses form an apron at the foot of each actual building.
  const apron=[[-126,22],[-82,8],[75,12],[133,31],[112,66],[49,82],[-92,76],[-140,49]].map(([x,y])=>({x:p.x+x!,y:p.y+y!}));
  if(apron.every(a=>inside(a.x,a.y)<.965))stone.poly(apron.flatMap(a=>[a.x,a.y])).fill({color:0xc9c8af,alpha:.19});
  for(let row=0;row<7;row++)for(let col=0;col<15;col++){
   const seed=index*1301+row*41+col,x=p.x-135+col*18+(row%2)*9,y=p.y+13+row*8;
   if(inside(x,y)>.965||Math.abs(x-p.x)>132-random(seed)*14)continue;
   const width=15+random(seed+2)*2,height=6+random(seed+3),chip=1+random(seed+4)*2;
   stone.poly([x,y+2,x+width*.5,y-height*.5,x+width,y+1,x+width-chip,y+height*.55,x+width*.45,y+height,x+1,y+height*.5]).fill({color:[0xdad2b8,0xe3dbc1,0xc7c7ad,0xd3cbb1][Math.floor(random(seed+8)*4)]!,alpha:.33});
   stone.moveTo(x+1,y+2).lineTo(x+width*.5,y-height*.5).lineTo(x+width-1,y+1).stroke({width:.65,color:0xe1d8bd,alpha:.24});
   stone.moveTo(x+2,y+height*.5).lineTo(x+width*.45,y+height).lineTo(x+width-chip,y+height*.55).stroke({width:.5,color:0x748571,alpha:.25});
   if(row>4&&col%4===0){stone.ellipse(x,y+6,3+random(seed)*4,1.2).fill({color:0x788d68,alpha:.35});stone.moveTo(x,y+5).lineTo(x+1,y+2).stroke({width:.7,color:0x879b74,alpha:.7});}
  }
  for(let i=0;i<4;i++){const x=p.x-95+i*61,y=p.y+70+random(index*13+i)*17;if(inside(x,y)<.96)puddles.push({x,y});}
  // Fine rubble follows the apron edges, never a large decorative collision shape.
  for(let i=0;i<35;i++){const x=p.x-140+random(i+index*211)*280,y=p.y+70+random(i+511)*28;if(inside(x,y)>.965)continue;stone.ellipse(x,y,1+random(i)*2,.7).fill({color:0x8a9279,alpha:.34});}
 }
 let lastWet=-1,lastPhase=-1;
 return{root,update:(amount:number,time:number)=>{
  const w=Math.round(amount*20)/20,phase=Math.floor(time*8);
  if(w===lastWet&&(w<.05||phase===lastPhase))return;lastWet=w;lastPhase=phase;wet.clear();
  if(w<.05)return;
  puddles.forEach((p,i)=>{const rx=12+random(i)*15;wet.ellipse(p.x,p.y,rx,3.5).fill({color:0x779b96,alpha:w*.27});wet.moveTo(p.x-rx*.6,p.y-1).lineTo(p.x+rx*.45,p.y-1).stroke({width:.8,color:0xebe4cc,alpha:w*.45});const r=1+((time*.65+i*.27)%1)*9;wet.ellipse(p.x+3,p.y,r,r*.27).stroke({width:.55,color:0xe4e8d5,alpha:w*.24*(1-r/11)});});
 }};
}

/** Ropes belong to decorative rowboats only; the ferry and its passengers are untouched. */
export function harborMoorings(scene:Container,boats:Container[],piers:Point[]){
 const lines=boats.map(boat=>{const pier=piers.reduce<Point|undefined>((best,p)=>!best||Math.hypot(p.x-boat.x,p.y-boat.y)<Math.hypot(best.x-boat.x,best.y-boat.y)?p:best,undefined);if(!pier||Math.hypot(pier.x-boat.x,pier.y-boat.y)>190)return null;const g=new Graphics();g.zIndex=boat.zIndex+2;scene.addChild(g);return{boat,pier,g};});
 return()=>{for(const line of lines){if(!line)continue;const{boat,pier,g}=line;const x=boat.x-28*Math.sign(boat.scale.x),y=boat.y+1,ax=pier.x+20,ay=pier.y+8;g.clear();g.moveTo(ax,ay).quadraticCurveTo((ax+x)/2-6,(ay+y)/2+9,x,y).stroke({width:1.2,color:0xbda67c,alpha:.9});g.circle(ax,ay,2.4).stroke({width:1,color:0x706d56});}};
}
