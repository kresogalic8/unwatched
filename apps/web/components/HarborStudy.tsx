"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import styles from "./HarborStudy.module.css";

type Mode = "day" | "dusk" | "rain";
import { P, pts, patch, noise, cos, sin, land, landShape, Face, Line, Pot, House, Tree, Barrel, Lamp, Table, Boat } from "./world/harbor-art";
import { RigPerson } from "./RigPerson";
type Point = [number, number];

export function HarborStudy(){
 const [mode,setMode]=useState<Mode>("day");const lit=mode==="dusk";
 const objects:{depth:number;node:ReactNode}[]=[];const add=(u:number,v:number,node:ReactNode)=>objects.push({depth:P(u,v)[1],node});
 add(100,210,<House u={-15} v={105} w={130} d={105} h={127} name="ATELIER" color="#ddd5b8" side="#b8bca2" roof={2} lit={lit}/>);
 add(303,134,<House u={156} v={39} w={147} d={95} h={176} name="CASA MIRA" lit={lit}/>);
 add(515,150,<House u={366} v={45} w={149} d={105} h={133} name="KONOBA" color="#e4c4a0" side="#bbb59a" roof={4} cafe lit={lit}/>);
 add(63,345,<House u={-24} v={285} w={87} d={60} h={62} name="MREŽE" color="#d9d8be" side="#b4bca4" roof={1} lit={lit}/>);
 add(66,96,<Tree u={66} v={96} scale={1.08}/>);
 add(538,180,<Tree u={538} v={180} scale={1.1}/>);
 add(110,298,<Tree u={110} v={298} scale={1.05}/>);
 add(590,349,<Tree u={590} v={349} scale={.9}/>);
 add(354,186,<Barrel u={354} v={186}/>);add(332,190,<Barrel u={332} v={190}/>);
 add(74,351,<Barrel u={74} v={351}/>);add(91,347,<Barrel u={91} v={347}/>);
 add(25,233,<Pot u={25} v={233} size={1.3} flowers/>);add(80,232,<Pot u={80} v={232} flowers/>);
 add(391,231,<Table u={391} v={231} parasol/>);add(467,270,<Table u={467} v={270}/>);
 add(274,273,<RigPerson u={274} v={273} name="Mara Tomić" top="Teal" hat pose="carry"/>);
 add(285,190,<RigPerson u={285} v={190} name="Petar Ilić" top="Sand" pose="talk"/>);
 add(313,204,<RigPerson u={313} v={204} name="Rosa Vidal" top="Sage" pose="talk" flip/>);
 add(438,267,<RigPerson u={438} v={267} name="Ana Perić" top="Cream" hat pose="talk"/>);
 add(530,389,<RigPerson u={530} v={389} name="Luka Babić" top="Teal" pose="carry"/>);
 add(157,384,<RigPerson u={157} v={384} name="Tomo Radić" top="Sand" hat/>);
 for(const [u,v]of [[203,403],[427,401],[564,266]] as Point[])add(u,v,<Lamp u={u} v={v} lit={lit}/>);
 const time={day:"16:20 · The afternoon lingers",dusk:"20:40 · One more light comes on",rain:"09:10 · Rain on the old stones"}[mode];
 return <main className={`${styles.study} ${styles[mode]}`}>
 <header className={styles.header}><Link href="/" className={styles.wordmark}><span className={styles.mark}>⌑</span> unwatched<span className={styles.divider}/><span className={styles.studyLabel}>A place in the making</span></Link><span className={styles.local}>LOCAL VISUAL STUDY / 01</span></header>
 <section className={styles.scene} aria-label="Harbor Street visual prototype">
 <div className={styles.title}><p>THE LOWER HARBOR</p><h1>Harbor Street.</h1><span>{time}</span></div>
 <div className={styles.modes} role="group" aria-label="Lighting"><button aria-pressed={mode==="day"} onClick={()=>setMode("day")}>Afternoon</button><button aria-pressed={mode==="dusk"} onClick={()=>setMode("dusk")}>Blue hour</button><button aria-pressed={mode==="rain"} onClick={()=>setMode("rain")}>Coastal rain</button></div>
 <svg viewBox="0 0 1300 850" role="img" aria-label={`Harbor Street, ${mode}: limestone houses, clay roofs, olive trees and a small harbor`} className={styles.art}>
 <defs>
 <linearGradient id="hs-sea" x2="0" y2="1"><stop stopColor={mode==="dusk"?"#657f86":mode==="rain"?"#b4c9c1":"#d1ded0"}/><stop offset="1" stopColor={mode==="dusk"?"#344f65":mode==="rain"?"#89b1b0":"#85bab5"}/></linearGradient>
 <radialGradient id="hs-vignette"><stop offset=".45" stopColor="#ece9db" stopOpacity="0"/><stop offset="1" stopColor={mode==="dusk"?"#57747e":"#eeeadd"} stopOpacity=".8"/></radialGradient>
 <filter id="hs-soft" x="-30%" y="-50%" width="180%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
 <filter id="hs-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="10"/></filter>
 <pattern id="hs-plaster" width="35" height="29" patternUnits="userSpaceOnUse">{Array.from({length:22},(_,i)=><circle key={i} cx={noise(i)*35} cy={noise(i+82)*29} r={.3+noise(i+41)*.6} fill="#8a8770" opacity=".4"/>)}</pattern>
 <filter id="hs-grain"><feTurbulence type="fractalNoise" baseFrequency=".63" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".045"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter>
 <filter id="hs-evening"><feColorMatrix type="matrix" values=".50 0 0 0 .015 0 .63 0 0 .025 0 0 .77 0 .06 0 0 0 1 0"/></filter>
 <filter id="hs-rain"><feColorMatrix type="matrix" values=".78 .08 0 0 .02 .03 .83 0 0 .03 .04 .08 .84 0 .04 0 0 0 1 0"/></filter>
 <clipPath id="hs-land"><polygon points={landShape}/></clipPath>
 </defs>
 <rect width="1300" height="850" fill="url(#hs-sea)"/>
 {/* Water stays sparse so the little street has room to breathe. */}
 {Array.from({length:58},(_,i)=>{const x=40+noise(i+6)*1230,y=350+noise(i+100)*455;return <path key={i} d={`M${x} ${y}q${9+noise(i)*20} -3 ${23+noise(i+1)*38} 0`} stroke="#e8edda" strokeWidth={.6+noise(i)} fill="none" opacity={.16+noise(i+10)*.3}/>;})}
 <g filter={mode==="dusk"?"url(#hs-evening)":mode==="rain"?"url(#hs-rain)":undefined}>
 <polygon points={pts(land.map(([u,v])=>{const [x,y]=P(u,v);return [x+18,y+25];}))} fill="#376d65" opacity=".17" filter="url(#hs-glow)"/>
 {/* The quay is a thick wall, not a flat cutout. */}
 {land.map(([u,v],i)=>{const next=land[(i+1)%land.length]!;return <Face key={i} points={[P(u,v),P(...next),P(next[0],next[1],-26),P(u,v,-26)]} fill={i<3?"#aaaF96":"#b1b49b"} stroke="#889580" width={.8}/>;})}
 <polygon points={landShape} fill={mode==="rain"?"#c2c4ae":"#ddd7bd"} stroke="#f0e6ce" strokeWidth="4"/>
 <g clipPath="url(#hs-land)">{Array.from({length:29},(_,i)=>Array.from({length:22},(_,j)=>{const u=-75+i*26+(j%2)*13,v=10+j*24;return <polygon key={`${i}-${j}`} points={patch(u+1,v+1,24,22)} fill={["#d7d1b8","#dcd6bf","#cfcbb2","#e3ddc5","#d7d5bd"][(i*3+j*7)%5]} stroke="#babda4" strokeWidth=".55" opacity=".72"/>;}))}</g>
 <polygon points={landShape} fill="url(#hs-plaster)" opacity=".55"/>
 {/* Stone cap blocks along the water. */}
 {Array.from({length:18},(_,i)=><Face key={i} points={[P(230+i*17.6,463,1),P(247+i*17.6,463,1),P(247+i*17.6,477,1),P(230+i*17.6,477,1)]} fill={i%2?"#d9d5bc":"#e5dec5"} stroke="#aaaE96" width={.8}/>)}
 {Array.from({length:12},(_,i)=><Line key={i} a={P(245+i*26,470,-2)} b={P(245+i*26,470,-25)} color="#919d87" width={.7}/>)}
 {/* Timber landing, with posts visibly descending to the water. */}
 {Array.from({length:12},(_,i)=><Face key={i} points={[P(532,432+i*8,-3),P(600,432+i*8,-3),P(600,439+i*8,-3),P(532,439+i*8,-3)]} fill={i%2?"#b6aa89":"#c5b797"} stroke="#918e70" width={.6}/>)}
 {[[533,440],[597,440],[533,511],[597,511]].map(([u,v],i)=><g key={i}><Line a={P(u!,v!,13)} b={P(u!,v!,-27)} color="#7d8064" width={5}/><ellipse cx={P(u!,v!,13)[0]} cy={P(u!,v!,13)[1]} rx="3" ry="1.6" fill="#d0c09a"/></g>)}
 {/* Steps and a low wall around the olive courtyard. */}
 {Array.from({length:4},(_,i)=><Face key={i} points={[P(130,220+i*7,i*2),P(200,220+i*7,i*2),P(200,226+i*7,i*2),P(130,226+i*7,i*2)]} fill={i%2?"#e5dfc8":"#d3cdb5"} stroke="#abae94" width={.8}/>)}
 <path d={`M${P(30,259)}Q${P(54,255,13)} ${P(80,272)}`} stroke="#b4b496" strokeWidth="8" fill="none"/>
 {mode==="rain"&&[[255,339,60,12],[387,368,48,10],[480,190,28,8],[169,298,29,8]].map(([u,v,rx,ry],i)=>{const [x,y]=P(u!,v!);return <g key={i}><ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#a0bcb0" opacity=".65"/><path d={`M${x-rx!*.7} ${y}h${rx!}`} stroke="#e2e3ce" opacity=".65"/></g>;})}
 {objects.sort((a,b)=>a.depth-b.depth).map((o,i)=><g key={i}>{o.node}</g>)}
 {/* A clothesline across the little gap: domestic details at human scale. */}
 <path d={`M${P(121,170,96)}Q${P(153,165,79)} ${P(174,158,111)}`} stroke="#8b8c70" strokeWidth="1" fill="none"/>
 {[[134,169,89],[151,165,94]].map(([u,v,k],i)=>{const [x,y]=P(u!,v!,k!);return <g key={i} transform={`translate(${x} ${y}) rotate(-8)`}><path d="M-8 0H9L11 20Q1 24 -9 19Z" fill={i?"#b3c4b1":"#ede5cd"} stroke="#a7ad91" strokeWidth=".7"/><path d="M-5 -1V3M6 -1V3" stroke="#907d5c" strokeWidth="1.8"/></g>;})}
 {/* Fishing nets drying outside the store. */}
 <g transform={`translate(${P(75,309,29)})`} opacity=".8"><path d="M0 0L30 13L20 43L-10 29Z" fill="#b1ae89" opacity=".35"/>{Array.from({length:6},(_,i)=><g key={i}><path d={`M${i*6} ${i*2.6}l-10 29M${-i*2} ${i*5.8}l30 13`} stroke="#878c6b" strokeWidth=".65"/></g>)}</g>
 </g>
 <Boat className={styles.boat} u={500} v={568}/>
 <path d={`M${P(562,514)}Q${P(549,545,-12)} ${P(505,549,-3)}`} stroke="#b9b89a" strokeWidth="1.2" fill="none"/>
 {lit&&<g>{[[65,220],[230,150],[416,180]].map(([u,v],i)=>{const [x,y]=P(u!,v!);return <ellipse key={`pool-${i}`} cx={x} cy={y} rx="39" ry="15" fill="#f5cc81" opacity=".15" filter="url(#hs-soft)"/>;})}{[[203,403],[427,401],[564,266]].map(([u,v],i)=>{const [x,y]=P(u!,v!,80);return <g key={i}><circle cx={x+20} cy={y} r="26" fill="#ffd38a" opacity=".25" filter="url(#hs-glow)"/><circle cx={x+20} cy={y} r="3" fill="#ffe5ac"/></g>;})}</g>}
 {mode==="rain"&&<g className={styles.rain} stroke="#edf1e0" strokeWidth="1" opacity=".28">{Array.from({length:115},(_,i)=>{const x=noise(i+280)*1300,y=noise(i+490)*850;return <path key={i} d={`M${x} ${y}l-5 14`}/>;})}</g>}
 <rect width="1300" height="850" fill="url(#hs-vignette)" pointerEvents="none"/>
 <rect width="1300" height="850" opacity=".32" filter="url(#hs-grain)" fill="transparent" pointerEvents="none"/>
 {/* Two distant gulls over the harbor. */}
 <g fill="none" stroke={lit?"#d2d5c3":"#748f81"} strokeWidth="1.5" opacity=".7"><path d="M1065 310q7 -8 13 0q7 -8 13 0M1097 328q5 -6 10 0q5 -6 10 0"/></g>
 </svg>
 <div className={styles.caption}><span className={styles.coordinate}>43° 30′ N &nbsp; 16° 26′ E</span><h2>A street worth<br/>coming back to.</h2><p>Limewashed walls. Clay roofs. The shade of an olive tree.<br/>A first look at a more lived-in Unwatched.</p></div>
 <div className={styles.legend}><span><i/> Materials & light study</span><p>Staged scene · not a live simulation</p></div>
 </section>
 <footer className={styles.footer}><span>01 / HARBOR STREET</span><span>Local prototype — architecture, props & atmosphere</span><Link href="/town">Back to the current island ↗</Link></footer>
 </main>;
}
