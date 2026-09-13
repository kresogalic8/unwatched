import { Container, Graphics } from 'pixi.js';
import type { Decoration } from '@unwatched/protocol';
import { drawThing } from './buildings';

export function markPosition(index: number, place?: {x:number;y:number}, center?: {x:number;y:number}, inside?: (x:number,y:number)=>number) {
  const p={ x: -96 + (index % 3) * 86, y: 78 + Math.floor(index / 3) * 40 };
  if(place && center && inside) for(let step=0;step<100 && inside(place.x+p.x,place.y+p.y)>.94;step++) {
    const dx=center.x-place.x-p.x,dy=center.y-place.y-p.y,d=Math.max(1,Math.hypot(dx,dy));p.x+=dx/d*8;p.y+=dy/d*8;
  }
  return p;
}
export function drawPlaceMarks(marks: Decoration[], position: (index:number)=>{x:number;y:number} = markPosition): Container {
  const root = new Container();
  for (const [i, mark] of marks.entries()) {
    const p = position(i), g = new Graphics();
    const part = new Container(); part.position.set(p.x,p.y); root.addChild(part);
    if (mark.kind === 'bench') { const bench = drawThing('bench'); if (bench) part.addChild(bench.c); continue; }
    part.addChild(g);
    g.ellipse(0,3,mark.kind==='flowers'?24:14,5).fill({color:0x526e55,alpha:.17});
    if (mark.kind === 'flowers') {
      g.ellipse(0,0,23,6).fill({color:0x786e4e,alpha:.65});
      for(let n=0;n<9;n++) { const x=-20+n*5,y=Math.sin(n*2.1)*3,h=8+(n%3)*3;
        g.moveTo(x,y).quadraticCurveTo(x+2,y-h*.5,x,y-h).stroke({width:1.2,color:0x5b8054});
        g.ellipse(x+2,y-h*.4,3,1.5).fill(0x81945e);
        for(let k=0;k<5;k++){const a=k*Math.PI*2/5;g.circle(x+Math.cos(a)*2,y-h+Math.sin(a)*2,1.7).fill([0xd89178,0xe4cd88,0xae9ab0][n%3]!);}
        g.circle(x,y-h,1.1).fill(0xf0d89b);
      }
    } else for(let n=0;n<4;n++){g.ellipse((n%2)*2,n*-4,12-n*2.5,3).fill([0x9ba18b,0xb5b29c][n%2]!).stroke({width:.7,color:0x777f70});}
  }
  return root;
}
