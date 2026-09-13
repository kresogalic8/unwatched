import { Graphics } from 'pixi.js';
type Walker={id:string;x:number;y:number;moving:boolean};
/** Short-lived physical traces of observed movement; never generates walking. */
export class Footfall {
  readonly g=new Graphics();
  private previous=new Map<string,{x:number;y:number}>();
  private motes:{x:number;y:number;at:number;wet:boolean}[]=[];
  private last=-1;
  update(time:number,people:Walker[],wet:boolean,reduced:boolean,inside:(x:number,y:number)=>number){
    if(time-this.last<1/30)return;this.last=time;
    const ids=new Set(people.map(p=>p.id));for(const id of this.previous.keys())if(!ids.has(id))this.previous.delete(id);
    for(const p of people){const old=this.previous.get(p.id);if(!old){this.previous.set(p.id,p);continue;}const d=Math.hypot(p.x-old.x,p.y-old.y);if(d<13)continue;
      if(p.moving&&!reduced&&d<50&&inside(p.x,p.y)<.98)this.motes.push({x:p.x,y:p.y,at:time,wet});
      this.previous.set(p.id,p);
    }
    this.motes=this.motes.filter(m=>time-m.at<.8).slice(-100);this.g.clear();
    for(const m of this.motes){const age=(time-m.at)/.8;
      if(m.wet)this.g.ellipse(m.x,m.y,2+age*7,1+age*2.5).stroke({color:0xdce6cc,width:.8,alpha:(1-age)*.5});
      else for(let i=0;i<3;i++)this.g.circle(m.x+(i-1)*age*7,m.y-age*8+i,1+age*2).fill({color:0xd6c5a3,alpha:(1-age)*.18});
    }
  }
}
