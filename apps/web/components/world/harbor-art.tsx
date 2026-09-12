import React from "react";
import { HARBOR_PERSON } from "./person-art";

/** Canonical Harbor Street artwork, shared by the visual study and the generated world atlas. */
type Point = [number, number];
export const P = (u:number,v:number,z=0):Point => [560+(u-v)*.95,210+(u+v)*.44-z];
export const pts = (points:Point[]) => points.map(p=>p.join(",")).join(" ");
export const patch = (u:number,v:number,w:number,d:number,z=0) => pts([P(u,v,z),P(u+w,v,z),P(u+w,v+d,z),P(u,v+d,z)]);
// Integer hashing avoids server/browser libm differences in hydrated SVG attributes.
export const noise = (n:number) => {let h=Math.imul((n|0)^0x9e3779b9,0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return ((h^(h>>>16))>>>0)/4294967296;};
export const cos=(n:number)=>Math.round(Math.cos(n)*1e6)/1e6;
export const sin=(n:number)=>Math.round(Math.sin(n)*1e6)/1e6;
const wallInk="#756e5c";
const tileColors=["#bd7858","#cf8762","#c4805c","#d3946b","#af6f53","#c58b69"];
export const land=[[-58,25],[594,25],[658,124],[658,392],[548,470],[230,470],[-58,342]] as Point[];
export const landShape=pts(land.map(([u,v])=>P(u,v)));

export function Face({points,fill,stroke=wallInk,width=.8}:{points:Point[];fill:string;stroke?:string;width?:number}){
 return <polygon points={pts(points)} fill={fill} stroke={stroke} strokeWidth={width} strokeLinejoin="round" />;
}
export function Line({a,b,color=wallInk,width=1}:{a:Point;b:Point;color?:string;width?:number}){return <path d={`M${a}L${b}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round"/>;}
export function Pot({u,v,size=1,flowers=false}:{u:number;v:number;size?:number;flowers?:boolean}){
 const [x,y]=P(u,v);return <g transform={`translate(${x} ${y}) scale(${size})`}>
 <ellipse cy="2" rx="12" ry="4" fill="#3c534b" opacity=".16"/><path d="M-8 -12L-6 0Q0 5 6 0L8 -12Z" fill="#bb7858" stroke="#885d47" strokeWidth=".9"/><ellipse cy="-12" rx="9" ry="3" fill="#d49a72"/><ellipse cy="-12" rx="6.5" ry="1.9" fill="#655a41"/>
 {Array.from({length:13},(_,i)=>{const a=i*2.4,r=4+noise(i)*8;return <ellipse key={i} cx={cos(a)*r} cy={-16+sin(a)*r*.5-i*.3} rx="4.5" ry="3" transform={`rotate(${i*29} ${cos(a)*r} ${-16+sin(a)*r*.5-i*.3})`} fill={i%3===0?"#6b8053":"#869562"}/>;})}
 {flowers&&Array.from({length:7},(_,i)=><circle key={i} cx={cos(i*2.4)*8} cy={-20+sin(i*2.4)*6} r="2.5" fill={i%2?"#b35c59":"#e3a2a1"}/>)}
 </g>;
}
export function Window({u,v,k,w=22,h=33,side=false,lit=false,shutters="#57796c"}:{u:number;v:number;k:number;w?:number;h?:number;side?:boolean;lit?:boolean;shutters?:string}){
 const [x,y]=P(u,v,k);return <g transform={`matrix(${side?-.95:.95} .44 0 1 ${x} ${y})`}>
 <rect x="-3" y={-h-3} width={w+6} height={h+7} fill="#ded5be" stroke="#9c9580" strokeWidth=".7"/>
 <rect y={-h} width={w} height={h} fill={lit?"#ecc480":"#425b58"}/><path d={`M1 ${-h+2}H${w-1}L1 -3Z`} fill={lit?"#ffe4a3":"#98b3a5"} opacity=".46"/>
 <path d={`M0 0V${-h}H${w}v3H3V0Z`} fill="#253f3b" opacity=".55"/>
 <path d={`M${w-2} ${-h+4}L${w*.6} -4M${w-6} ${-h+4}L${w*.6-4} -4`} stroke="#e5edcf" strokeWidth=".8" opacity={lit?.12:.35}/>
 <path d={`M${w/2} ${-h}V0M0 ${-h*.52}H${w}`} stroke={lit?"#ab865a":"#b6b59c"} strokeWidth="1.5"/>
 <rect x={-w*.48-3} y={-h} width={w*.42} height={h+1} rx="1" fill={shutters} stroke="#51685b" strokeWidth=".8"/>
 <rect x={w+3} y={-h} width={w*.42} height={h+1} rx="1" fill={shutters} stroke="#51685b" strokeWidth=".8"/>
 {Array.from({length:8},(_,i)=><path key={i} d={`M${-w*.48-1} ${-h+4+i*3.6}h${w*.32}M${w+5} ${-h+4+i*3.6}h${w*.29}`} stroke="#304d47" strokeWidth=".65" opacity=".55"/>)}
 {[-h+5,-5].map(y=><g key={y}><path d={`M-3 ${y}h-4M${w+3} ${y}h4`} stroke="#344b42" strokeWidth="1.4"/><circle cx="-5" cy={y} r=".8" fill="#c2b38b"/><circle cx={w+5} cy={y} r=".8" fill="#c2b38b"/></g>)}
 <path d={`M-5 8H${w+7}l3 3H-3Z`} fill="#626d59" opacity=".2"/>
 <path d={`M-6 3H${w+6}V7H-6Z`} fill="#e5dec9" stroke="#969780" strokeWidth=".65"/>
 </g>;
}
export function Door({u,v,arch=false,color="#547666"}:{u:number;v:number;arch?:boolean;color?:string}){
 const [x,y]=P(u,v);return <g transform={`matrix(.95 .44 0 1 ${x} ${y})`}>
 <path d={arch?"M-4 0V-39Q17 -68 38 -39V0Z":"M-4 0V-59H38V0Z"} fill="#ded4bb" stroke="#9c947b" strokeWidth="1"/>
 <path d={arch?"M0 0V-38Q17 -59 34 -38V0Z":"M0 0V-54H34V0Z"} fill={color}/>
 <path d="M17 -49V0M4 -28H30M4 -4V-24H30V-4Z" stroke="#344f47" strokeWidth="1" fill="none" opacity=".8"/>
 <path d="M1 -34V-2H33M3 -3H31" fill="none" stroke="#b2bd91" strokeWidth=".8" opacity=".55"/>
 {[7,12,22,28].map(x=><path key={x} d={`M${x} -23v17`} stroke="#263f38" strokeWidth=".45" opacity=".45"/>)}
 <path d="M0 0V-35" stroke="#293f37" strokeWidth="2.5" opacity=".7"/>
 <circle cx="27" cy="-26" r="1.4" fill="#d4b07d"/><path d="M-7 1H42L45 6H-10Z" fill="#d8ceb5" stroke="#989b83" strokeWidth=".7"/>
 </g>;
}
export function House({u,v,w,d,h,name,color="#ece3cc",side="#c4c5ac",roof=0,lit=false,cafe=false}:{u:number;v:number;w:number;d:number;h:number;name:string;color?:string;side?:string;roof?:number;lit?:boolean;cafe?:boolean}){
 const rise=40;const front=v+d;const q=(i:number,j:number,k:number)=>P(u+i,v+j,k);
 const frontPolygon=pts([q(0,d,0),q(w,d,0),q(w,d,h),q(0,d,h)]);
 return <g>
 <polygon points={pts([q(-4,-4,0),q(w+8,-4,0),q(w+80,d+35,0),q(58,d+40,0),q(-4,d+5,0)])} fill="#455c49" opacity=".13" filter="url(#hs-soft)"/>
 <Face points={[q(0,d,0),q(w,d,0),q(w,d,h),q(0,d,h)]} fill={color}/>
 <Face points={[q(w,d,0),q(w,0,0),q(w,0,h),q(w,d,h)]} fill={side}/>
 <polygon points={frontPolygon} fill="url(#hs-plaster)" opacity=".22"/>
 <Face points={[q(w,0,0),q(w,d,0),q(w,d,7),q(w,0,7)]} fill="#a2a992"/>
 <Face points={[q(0,d,0),q(w,d,0),q(w,d,8),q(0,d,8)]} fill="#cec7b0"/>
 {/* Corner stones and roof overhang anchor the walls in depth. */}
 <Face points={[q(w,d,9),q(w,0,9),q(w,0,18),q(w,d,18)]} fill="#89957e" stroke="none"/>
 <Face points={[q(0,d,h-7),q(w,d,h-7),q(w,d,h-16),q(0,d,h-16)]} fill="#776e55" stroke="none"/>
 {Array.from({length:Math.floor(h/18)},(_,i)=>{const z=10+i*18;return <g key={`quoin-${i}`} opacity=".48"><Face points={[q(w-9,d,z),q(w,d,z),q(w,d,z+8),q(w-9,d,z+8)]} fill="#d5c9ac" stroke="#afa58c" width={.4}/><Face points={[q(w,d,z),q(w,d-8,z),q(w,d-8,z+8),q(w,d,z+8)]} fill="#b1b298" stroke="#929b83" width={.4}/></g>;})}
 {/* Scattered worn limestone peeking through the limewash. */}
 {Array.from({length:20},(_,i)=>{const a=5+noise(i+w)*(w-17),k=8+noise(i+h)*(h-17);return <Face key={i} points={[q(a,d,k),q(a+7+noise(i)*7,d,k),q(a+7+noise(i)*7,d,k+3),q(a,d,k+3)]} fill={i%2?"#d7cbae":"#eee6d0"} stroke="none"/>;})}
 <Door u={u+(cafe?w-48:24)} v={front+.6} arch={!cafe}/>
 {h>115&&<><Window u={u+26} v={front+.5} k={h-48} lit={lit}/><Window u={u+w-52} v={front+.5} k={h-48} lit={lit}/></>}
 {!cafe&&<Window u={u+w-53} v={front+.5} k={24} lit={lit} h={29}/>}
 <Window u={u+w+.5} v={v+27} k={h-49} side lit={lit} w={20} h={29}/>
 {h>140&&<Window u={u+w+.5} v={v+28} k={30} side lit={lit} w={20} h={27}/>}
 {h>140&&<>
 <Face points={[q(17,d+1,h-51),q(w-15,d+1,h-51),q(w-15,d+16,h-51),q(17,d+16,h-51)]} fill="#dbd0b5"/>
 <Face points={[q(17,d+16,h-51),q(w-15,d+16,h-51),q(w-15,d+16,h-56),q(17,d+16,h-56)]} fill="#b8b49b"/>
 {Array.from({length:12},(_,i)=><Line key={i} a={q(20+i*9,d+16,h-50)} b={q(20+i*9,d+16,h-29)} color="#5f7562" width={1.4}/>)}
 <Line a={q(17,d+16,h-29)} b={q(w-15,d+16,h-29)} color="#4f6c5c" width={2.4}/>
 <Line a={q(17,d+1,h-29)} b={q(17,d+16,h-29)} color="#4f6c5c" width={2.4}/>
 <Line a={q(w-15,d+1,h-29)} b={q(w-15,d+16,h-29)} color="#4f6c5c" width={2.4}/>
 </>}
 {h>100&&<g>{Array.from({length:40},(_,i)=>{const [x,y]=q(w-5-noise(i+80)*12,d+.8,18+i*2.2);return <ellipse key={i} cx={x} cy={y} rx={3+noise(i)*3} ry={2+noise(i+10)*3} fill={i%3?"#8a9b69":"#647e59"}/>;})}</g>}
 {/* Deep cornice, gable and individually shaded clay tiles. */}
 <Face points={[q(-3,d+3,h),q(w+4,d+3,h),q(w+4,d+3,h-7),q(-3,d+3,h-7)]} fill="#aea68e"/>
 <Face points={[q(-7,-6,h),q(w+7,-6,h),q(w+7,d/2,h+rise),q(-7,d/2,h+rise)]} fill="#965d47"/>
 <Face points={[q(w+7,-6,h),q(w+7,d+6,h),q(w+7,d/2,h+rise)]} fill={color}/>
 <Face points={[q(-7,d+6,h),q(w+7,d+6,h),q(w+7,d/2,h+rise),q(-7,d/2,h+rise)]} fill="#bd7c58"/>
 {Array.from({length:Math.ceil((w+14)/13)},(_,i)=>Array.from({length:5},(_,j)=>{
 const a=-7+i*13,b=Math.min(w+7,a+12.7),va=d/2+(d/2+6)*j/5,vb=d/2+(d/2+6)*(j+1)/5;
 return <g key={`${i}-${j}`}><Face points={[q(a,va,h+rise*(1-j/5)),q(b,va,h+rise*(1-j/5)),q(b,vb,h+rise*(1-(j+1)/5)),q(a,vb,h+rise*(1-(j+1)/5))]} fill={tileColors[(i+j*3+roof)%tileColors.length]!} stroke="#8f6048" width={.38}/><Line a={q(a+2,va+.8,h+rise*(1-j/5)-.6)} b={q(a+2,vb-.8,h+rise*(1-(j+1)/5)+.6)} color="#e4b085" width={.75}/><Line a={q(a,vb,h+rise*(1-(j+1)/5))} b={q(b,vb,h+rise*(1-(j+1)/5))} color="#85583f" width={.8}/></g>;
 }))}
 <Line a={q(-8,d/2,h+rise+1)} b={q(w+8,d/2,h+rise+1)} color="#daaa7d" width={4}/>
 <Line a={q(-8,d+6,h)} b={q(w+8,d+6,h)} color="#a96849" width={3}/>
 <path d={`M${q(w-3,d+.8,h-8)}L${q(w-3,d+.8,12)}`} stroke="#71816b" strokeWidth="2.4" fill="none"/>
 {[20,h*.45,h-20].map(z=><Line key={`pipe-${z}`} a={q(w-5,d+1,z)} b={q(w-1,d+1,z)} color="#485f51" width={1}/>)}
 {/* Chimney with a real cap and a short stack. */}
 <Face points={[q(w-32,14,h+5),q(w-18,14,h+5),q(w-18,14,h+54),q(w-32,14,h+54)]} fill="#d2bda0"/>
 <Face points={[q(w-18,14,h+5),q(w-18,2,h+5),q(w-18,2,h+54),q(w-18,14,h+54)]} fill="#a6a48d"/>
 <Face points={[q(w-35,0,h+54),q(w-15,0,h+54),q(w-15,17,h+54),q(w-35,17,h+54)]} fill="#ac6b4c"/>
 {cafe ? <>
 <g transform={`matrix(.95 .44 0 1 ${P(u+13,front+.5,0).join(" ")})`}><rect y="-56" width="70" height="46" fill="#405b50"/><rect x="4" y="-53" width="62" height="35" fill={lit?"#ddaf6c":"#668579"}/><path d="M23 -55V-12M46 -55V-12" stroke="#b2ae8b" strokeWidth="2"/></g>
 {Array.from({length:9},(_,i)=><Face key={i} points={[q(7+i*10,d+1,66),q(17+i*10,d+1,66),q(17+i*10,d+41,52),q(7+i*10,d+41,52)]} fill={i%2?"#e7dec7":"#788a67"} stroke="#69765a" width={.6}/>)}
 {Array.from({length:9},(_,i)=><Face key={i} points={[q(7+i*10,d+41,52),q(17+i*10,d+41,52),q(17+i*10,d+41,46),q(7+i*10,d+41,46)]} fill={i%2?"#d8cdb0":"#657755"} width={.4}/>)}
 <g transform={`matrix(.95 .44 0 1 ${P(u+13,front+2,83).join(" ")})`}><rect x="-3" y="-15" width="88" height="20" rx="2" fill="#f0e4c7" stroke="#a79c7d"/><text x="41" y="-.5" textAnchor="middle" fontSize="10" letterSpacing="2" fill="#526654" fontFamily="Georgia,serif">{name}</text></g>
 </> : <g transform={`matrix(.95 .44 0 1 ${P(u+20,front+1,64).join(" ")})`}><rect x="0" y="-12" width="46" height="12" rx="1" fill="#e6d8b5" stroke="#b0a382" strokeWidth=".6"/><text x="23" y="-3.3" textAnchor="middle" fontSize="5.7" letterSpacing=".8" fill="#5f6851" fontFamily="Georgia,serif">{name}</text></g>}
 <Pot u={u+8} v={front+9} flowers size={1.05}/><Pot u={u+w-6} v={front+7} size={.8}/>
 </g>;
}
export function Tree({u,v,scale=1}:{u:number;v:number;scale?:number}){
 const [x,y]=P(u,v);return <g transform={`translate(${x} ${y}) scale(${scale})`}>
 <ellipse cx="20" cy="7" rx="53" ry="16" fill="#506a50" opacity=".14" filter="url(#hs-soft)"/>
 <path d="M-5 0Q1 -28 -6 -59M2 -20Q22 -38 21 -59M-1 -34Q-23 -42 -26 -66" fill="none" stroke="#8d8263" strokeWidth="6" strokeLinecap="round"/>
 <path d="M-4 -3Q3 -24 -5 -57" fill="none" stroke="#b0a082" strokeWidth="2"/>
 {Array.from({length:42},(_,i)=>{const a=i*2.399,r=8+Math.sqrt(i/42)*40;const xx=cos(a)*r, yy=-73+sin(a)*r*.6;const rx=10+noise(i)*7,ry=8+noise(i+2)*5;return <path key={i} d={`M${xx-rx} ${yy}q${-rx*.2} ${-ry*.7} ${rx*.5} ${-ry*.65}q${rx*.1} ${-ry*.9} ${rx*.65} ${-ry*.3}q${rx*.6} ${-ry*.2} ${rx*.65} ${ry*.5}q${rx*.6} ${ry*.8} ${-rx*.3} ${ry}q${-rx*.7} ${ry*.6} ${-rx*1.5} ${-ry*.55}Z`} fill={["#738766","#829775","#99a67c","#a8af85","#667e61"][i%5]}/>;})}
 <path d="M-2 -37Q7 -48 12 -61M2 -43Q-9 -57 -17 -65M16 -40L28 -55" fill="none" stroke="#8d8766" strokeWidth="1.5" opacity=".6"/>
 {Array.from({length:65},(_,i)=><ellipse key={i} cx={-42+noise(i+32)*84} cy={-97+noise(i+68)*48} rx="2" ry="1" fill={i%2?"#ccd0a0":"#4f7056"} opacity=".65"/>)}
 </g>;
}
export function Person({u,v,coat="#657e76",pose="walk",hat=false,flip=false}:{u:number;v:number;coat?:string;pose?:"walk"|"talk"|"carry";hat?:boolean;flip?:boolean}){
 const [x,y]=P(u,v);return <g transform={`translate(${x} ${y}) scale(${flip?-1:1} 1)`}>
 <ellipse cx="3" cy="1" rx="12" ry="4" fill="#425f57" opacity=".2"/>
 <path d={pose==="walk"?"M-4 -14L-8 -2M4 -14L8 -1":"M-4 -14L-4 -1M4 -14L5 -1"} stroke="#516064" strokeWidth="5" strokeLinecap="round"/>
 <path d={pose==="walk"?"M-10 0H-4M6 0H12":"M-6 1H0M4 1H10"} stroke="#514d43" strokeWidth="3" strokeLinecap="round"/>
 <path d={HARBOR_PERSON.torso} fill={coat} stroke="#596657" strokeWidth=".7"/>
 <path d={pose==="talk"?"M6 -30L12 -20L21 -27":"M6 -30L10 -18L15 -17"} stroke={coat} strokeWidth="5.3" fill="none" strokeLinecap="round"/>
 <path d={pose==="talk"?"M20 -27l4 -2":"M14 -17l3 1"} stroke="#c79576" strokeWidth="3.3" strokeLinecap="round"/>
 <path d="M-6 -30L-11 -19" stroke={coat} strokeWidth="5" strokeLinecap="round"/>
 <rect x="-2.5" y="-39" width="5" height="6" rx="1" fill="#c79576"/>
 <ellipse cy="-43" rx="6.6" ry="8" fill="#d3a484"/>
 <path d={HARBOR_PERSON.hair} transform="translate(0 -43)" fill="#5c5143"/>
 <circle cx="4" cy="-43" r=".8" fill="#4d4f43"/><path d="M5 -41l3 1l-2 1" stroke="#ac7d60" strokeWidth=".8" fill="none"/>
 {hat&&<><ellipse cy="-50" rx="11" ry="3" fill="#cdb681"/><path d="M-6 -51L-5 -58Q1 -62 6 -57L7 -51Z" fill="#ddc68d"/><path d="M-6 -52Q0 -50 7 -52" stroke="#8d7d5e" strokeWidth="2"/></>}
 {pose==="carry"&&<><path d="M-17 -16Q-15 -28 -8 -16" fill="none" stroke="#8c7552" strokeWidth="1.8"/><path d="M-20 -16H-5L-7 -4H-18Z" fill="#be9f6e" stroke="#8d7855" strokeWidth=".8"/>{[0,1,2].map(i=><path key={i} d={`M-19 ${-13+i*3}h13`} stroke="#9e8258" strokeWidth=".7"/>)}<circle cx="-13" cy="-18" r="3" fill="#ab7654"/><circle cx="-8" cy="-17" r="3" fill="#91a168"/></>}
 </g>;
}
export function Barrel({u,v}:{u:number;v:number}){
 const [x,y]=P(u,v);return <g transform={`translate(${x} ${y})`}><ellipse cy="1" rx="12" ry="4" fill="#586b51" opacity=".17"/><path d="M-10 -23Q-14 -11 -9 0Q0 5 9 0Q14 -11 10 -23Z" fill="#ac9270" stroke="#7b765b" strokeWidth=".8"/><ellipse cy="-23" rx="10" ry="4" fill="#c6af86" stroke="#8b805e" strokeWidth=".8"/><path d="M-11 -18Q0 -13 11 -18M-11 -6Q0 -1 11 -6" fill="none" stroke="#707c6e" strokeWidth="2.3"/><ellipse cy="-23" rx="7.5" ry="2.5" fill="none" stroke="#887455" strokeWidth=".55"/><path d="M-8 -24L7 -24M-8 -22H7" stroke="#9a825e" strokeWidth=".5"/><circle cx="2" cy="-23" r="1" fill="#78674d"/><path d="M-4 -20L-4 0M3 -20L4 0" stroke="#937d5b" strokeWidth=".8"/></g>;
}
export function Lamp({u,v,lit}:{u:number;v:number;lit:boolean}){const [x,y]=P(u,v);return <g transform={`translate(${x} ${y})`}>
 <ellipse cx="7" cy="1" rx="15" ry="4" fill="#536955" opacity=".16"/><path d="M0 0V-82Q0 -91 9 -91H18" stroke="#576b5e" strokeWidth="3" fill="none"/><path d="M-5 0H5M-3 -6H3" stroke="#526154" strokeWidth="4"/>
 <path d="M12 -89H28L25 -75H15Z" fill={lit?"#f8d18d":"#c5cbaa"} stroke="#516255" strokeWidth="1.5"/><path d="M11 -90L20 -97L29 -90Z" fill="#657f6d"/>
 <path d="M16 -87L18 -77M20 -87L22 -77" stroke="#edf0d3" strokeWidth="1" opacity=".7"/><path d="M20 -88V-75M15 -74H26" stroke="#566c5d" strokeWidth="1"/>
 {lit&&<><ellipse cx="20" cy="-80" rx="30" ry="30" fill="#ffcf79" opacity=".18" filter="url(#hs-glow)"/><ellipse cx="22" cy="7" rx="49" ry="18" fill="#f2c886" opacity=".32" filter="url(#hs-soft)"/></>}
 </g>;}
export function Table({u,v,parasol=false}:{u:number;v:number;parasol?:boolean}){const [x,y]=P(u,v);return <g transform={`translate(${x} ${y})`}>
 <ellipse cy="4" rx="35" ry="11" fill="#607357" opacity=".14"/><path d="M0 -22V1M-8 2L0 -2L10 1" stroke="#6b785c" strokeWidth="3"/><path d="M-23 -23v3Q0 -5 23 -20v-3" fill="#a99773" stroke="#8f896a" strokeWidth=".6"/><ellipse cy="-23" rx="23" ry="10" fill="#d6c49b" stroke="#9c9875" strokeWidth="1"/>
 <ellipse cy="-23" rx="20" ry="8" fill="none" stroke="#eee0b9" strokeWidth=".6"/><path d="M-14 -26Q-4 -29 6 -27M-10 -19Q0 -17 14 -21" fill="none" stroke="#b3a17b" strokeWidth=".6"/>
 <ellipse cx="8" cy="-25" rx="5" ry="2" fill="#f4e9d0"/><path d="M-5 -27v-6" stroke="#586e54" strokeWidth="1"/><ellipse cx="-5" cy="-29" rx="3" ry="5" fill="#8c9a69"/>
 {[-1,1].map(n=><g key={n} transform={`translate(${n*32} 0)`}><path d="M-8 -10V6M8 -10V6M-8 -9H8M-8 -9V-23H8V-9" fill="none" stroke="#758166" strokeWidth="2.2"/><path d="M-8 -16H8" stroke="#758166" strokeWidth="1.4"/><path d="M-8 -10Q0 -13 8 -10V-8H-8Z" fill="#b9ac85" stroke="#798567" strokeWidth=".7"/><path d="M-6 -22H6" stroke="#abb998" strokeWidth=".8"/></g>)}
 {parasol&&<><path d="M0 -24V-92" stroke="#a49874" strokeWidth="2.5"/><ellipse cy="-72" rx="52" ry="18" fill="#d1c29a"/><path d="M-52 -72L0 -98L52 -72Q25 -59 0 -62Q-29 -59 -52 -72Z" fill="#eddfb8" stroke="#baae87" strokeWidth=".8"/><path d="M0 -98L-24 -64M0 -98L25 -64M0 -98V-62" stroke="#c9bb93" strokeWidth="1"/></>}
 </g>;}
export function Boat({u,v,className}:{u:number;v:number;className?:string}){const [x,y]=P(u,v);return <g transform={`translate(${x} ${y})`} className={className}>
 <ellipse cx="8" cy="16" rx="70" ry="19" fill="#2e7776" opacity=".13"/><path d="M-58 -10Q-22 -37 53 -13Q55 16 5 32Q-34 23 -58 -10Z" fill="#396d69" stroke="#446e64" strokeWidth="1.3"/><path d="M-58 -10Q-18 -29 53 -13Q20 9 5 17Q-21 9 -58 -10Z" fill="#c8bba0" stroke="#eeead2" strokeWidth="2.8"/>
 <path d="M-48 -7Q-18 13 5 25Q31 17 49 -4M-39 -1Q-11 18 5 28" fill="none" stroke="#254f4e" strokeWidth=".8" opacity=".6"/>
 <path d="M-42 -11Q-16 -19 37 -11M-29 -7Q-8 -12 22 -6" fill="none" stroke="#9d8f70" strokeWidth=".7"/>
 <path d="M-43 -9L3 12M-22 -16L23 3M-1 -20L40 -6" stroke="#9e9275" strokeWidth="6"/><path d="M-32 -24L33 28" stroke="#7d7e59" strokeWidth="2.8" strokeLinecap="round"/><path d="M29 25L44 38" stroke="#a28d64" strokeWidth="5.5" strokeLinecap="round"/>
 <ellipse cx="-24" cy="-9" rx="8" ry="3.5" fill="none" stroke="#a78c61" strokeWidth="1.4"/><ellipse cx="-24" cy="-9" rx="5" ry="2" fill="none" stroke="#a78c61" strokeWidth="1"/><path d="M-31 -9L-51 -12" stroke="#bca478" strokeWidth="1"/>
 <path d="M-2 22Q29 15 43 2" stroke="#cf8a67" strokeWidth="4" fill="none"/><path d="M-68 24Q-19 45 34 37M-42 45Q-8 53 23 47" stroke="#d1e2ce" strokeWidth="1.3" fill="none" opacity=".7"/>
 </g>;}
