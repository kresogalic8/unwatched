/** Rebuild with: node --import tsx apps/web/scripts/gen-harbor.tsx */
import React from 'react';
import { createHash } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { House, HouseFaces, HOUSE_SPECS, Tree, Barrel, Lamp, Table, Boat, Pot, P } from '../components/world/harbor-art';
import { HarborProp, HarborTower } from '../components/world/harbor-props';
import { HOUSES, atlasName, houseFacesSvg, houseSvg, type Kind } from '../components/world/dalmatian';
import { PROPS, propSvg } from '../components/world/dalmatian-props';
type Frame=[number,number,number,number,number]; // sheet, x, y, w, h
type FaceName='front'|'side'|'roof';
const assets:Record<string,{src:string;w:number;x:number;y:number;width:number;height:number;sheet?:number;frame?:[number,number,number,number];faces?:Record<FaceName,Frame>}>={};
/** Every drawing as rendered, kept for packing into the sheets the island loads. */
const drawings:{name:string;png:Buffer;pw:number;ph:number}[]=[];
/** Light masks: where each building faces the lane, faces along it, or faces the sky, as white on clear, at half the art's resolution. */
const masks:{name:string;png:Buffer;pw:number;ph:number}[]=[];const faceSource:Record<string,string>={};
const directory=new URL('../public/harbor/',import.meta.url);mkdirSync(directory,{recursive:true});
const pending:Promise<void>[]=[];
function add(name:string,node:React.ReactNode,w:number,anchor:[number,number],scale=1,faces?:React.ReactNode){
 const svg=renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg"><g transform={`scale(${scale}) translate(${-anchor[0]} ${-anchor[1]})`}>{node}</g></svg>)
 .replace(/<text\b[^>]*>[\s\S]*?<\/text>/g,'').replace(/\sfilter="[^"]*"/g,'').replace(/<polygon\b[^>]*fill="url\([^>]*\/>/g,'');
 const source=svg.replace('<svg ', '<svg width="1000" height="1000" viewBox="-500 -500 1000 1000" ');
 const bounds=new Resvg(source).getBBox();if(!bounds)throw new Error(`Empty artwork: ${name}`);
 const x=Math.floor(bounds.x)-2,y=Math.floor(bounds.y)-2,width=Math.ceil(bounds.width)+4,height=Math.ceil(bounds.height)+4;
 const cropped=source.replace('viewBox="-500 -500 1000 1000"',`viewBox="${x} ${y} ${width} ${height}"`).replace('width="1000" height="1000"',`width="${width}" height="${height}"`);
 const rendered=new Resvg(cropped,{fitTo:{mode:'zoom',value:3}}).render(),png=rendered.asPng();
 writeFileSync(new URL(name+'.png',directory),png);drawings.push({name,png,pw:rendered.width,ph:rendered.height});
 const version=createHash('sha256').update(png).digest('hex').slice(0,10);
 assets[name]={src:'/harbor/'+name+'.png?v='+version,w:w*scale,x,y,width,height};
 if(faces){
  // the face map in the same crop as the art, split by colour into three coverage masks
  const fsvg=renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`${x} ${y} ${width} ${height}`}><g transform={`scale(${scale}) translate(${-anchor[0]} ${-anchor[1]})`}>{faces}</g></svg>);
  const fpng=new Resvg(fsvg,{fitTo:{mode:'zoom',value:1.5}}).render().asPng();
  pending.push(sharp(fpng).ensureAlpha().raw().toBuffer({resolveWithObject:true}).then(async({data,info})=>{
   for(const [c,face] of (['front','side','roof'] as const).entries()){
    const out=Buffer.alloc(info.width*info.height*4);
    for(let i=0;i<info.width*info.height;i++){out[i*4]=out[i*4+1]=out[i*4+2]=255;out[i*4+3]=Math.round(data[i*4+c]!*data[i*4+3]!/255);}
    masks.push({name:name+':'+face,png:await sharp(out,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer(),pw:info.width,ph:info.height});
   }
  }));
 }
}
for(const [name,w,d,h,cafe,color,side] of HOUSE_SPECS) { add(name,<House u={0} v={0} w={w} d={d} h={h} name="" cafe={cafe} color={color} side={side}/>,(w+d)*.95,P(w,d),.72,<HouseFaces u={0} v={0} w={w} d={d} h={h} cafe={cafe}/>);faceSource[name]=name;
add(name+'-lit',<House u={0} v={0} w={w} d={d} h={h} name="" cafe={cafe} color={color} side={side} lit/>,(w+d)*.95,P(w,d),.72);
// A few colour-and-roof variants of the common houses, so a row of them never reads as clones. Base names are unchanged.
(({house:[['#e6d3b0','#c9c0a0',2],['#dbe0d2','#b6bfa8',4]],cottage:[['#e7d0ba','#c6bda0',3],['#d3dccd','#b2bca6',1]],shop:[['#e0d6c0','#bcb69a',5],['#e8cbb0','#c4b79a',2]]} as Record<string,[string,string,number][]>)[name]??[]).forEach(([vc,vs,vr],vi)=>{const vn=name+(vi+2);
add(vn,<House u={0} v={0} w={w} d={d} h={h} name="" cafe={cafe} color={vc} side={vs} roof={vr}/>,(w+d)*.95,P(w,d),.72);faceSource[vn]=name;
add(vn+'-lit',<House u={0} v={0} w={w} d={d} h={h} name="" cafe={cafe} color={vc} side={vs} roof={vr} lit/>,(w+d)*.95,P(w,d),.72);}); }
// The Dalmatian houses are drawn in the atlas's own units already, so they go in as they are, every colourway with its lit twin.
// Their light masks come from the same walls and roof the drawings stand on, one set per kind, shared by its colourways.
for(const kind of Object.keys(HOUSES) as Kind[]){
 const {w,d}=HOUSES[kind].spec;
 const faces=<g dangerouslySetInnerHTML={{__html:houseFacesSvg(kind)}}/>;
 for(let v=0;v<HOUSES[kind].ways;v++){const name=atlasName(kind,v);
  add(name,<g dangerouslySetInnerHTML={{__html:houseSvg(kind,v,false).svg}}/>,(w+d)*.95*.72,[0,0],1,v===0?faces:undefined);
  add(name+'-lit',<g dangerouslySetInnerHTML={{__html:houseSvg(kind,v,true).svg}}/>,(w+d)*.95*.72,[0,0],1);
  faceSource[name]=atlasName(kind,0);}
}
// The square's and the harbour's props in the same hand, drawn at the size the street places them.
for(const [name,prop] of Object.entries(PROPS)){add('dal-'+name,<g dangerouslySetInnerHTML={{__html:propSvg(name)!}}/>,prop.w,[0,0],1);if(prop.lit)add('dal-'+name+'-lit',<g dangerouslySetInnerHTML={{__html:propSvg(name,true)!}}/>,prop.w,[0,0],1);}
add('tree-large',<Tree u={0} v={0}/>,110,P(0,0),1.3);
add('tree-small',<Tree u={0} v={0}/>,110,P(0,0),.8);
add('olive',<Tree u={0} v={0}/>,110,P(0,0),.85);
add('barrel',<Barrel u={0} v={0}/>,26,P(0,0),1);
add('lamp',<Lamp u={0} v={0} lit={false}/>,36,P(0,0),.72);
add('terrace',<Table u={0} v={0}/>,84,P(0,0),.85);
add('parasol',<Table u={0} v={0} parasol/>,110,P(0,0),.85);
add('rowboat',<Boat u={0} v={0}/>,120,P(0,0),.75);
add('planter',<Pot u={0} v={0} flowers/>,30,P(0,0),1.2);
for(const [kind,w] of [['boat',180],['net',100],['washing',140],['cloth',140],['bench',74],['wall',130],['crates',60],['fence',140],['pier',280],['rock',48],['searocks',90],['cypress',36],['bush',55],['stall',150],['sawpit',150],['well',65],['field',180],['orchard',180],['quarry',190]] as const)add(kind,<HarborProp kind={kind}/>,w,[0,0]);
for(const kind of ['mill','chapel','lighthouse'] as const)add(kind,<HarborTower kind={kind}/>,90,[0,0]);
// The island draws from a few packed sheets instead of one texture per drawing: one request and one GPU texture each, so the whole
// street batches together. Shelves by height, tallest first; the gap between frames keeps filtering from bleeding one drawing into the next.
const SHEET=2048,GAP=4;
function pack(items:{name:string;png:Buffer;pw:number;ph:number}[]){
 const shelves:{sheet:number;y:number;h:number;x:number}[]=[];const sheets:{w:number;h:number;items:{png:Buffer;left:number;top:number}[]}[]=[];const at=new Map<string,Frame>();
 for(const d of [...items].sort((a,b)=>b.ph-a.ph||b.pw-a.pw||a.name.localeCompare(b.name))){
  if(d.pw>SHEET-GAP||d.ph>SHEET-GAP)throw new Error(`Too large for a sheet: ${d.name}`);
  let shelf=shelves.find(s=>s.x+d.pw+GAP<=SHEET&&d.ph<=s.h);
  if(!shelf){let sheet=sheets.length-1;const top=sheet<0?SHEET:shelves.filter(s=>s.sheet===sheet).reduce((m,s)=>Math.max(m,s.y+s.h+GAP),GAP);
   if(sheet<0||top+d.ph+GAP>SHEET){sheets.push({w:0,h:0,items:[]});sheet=sheets.length-1;shelf={sheet,y:GAP,h:d.ph,x:GAP};}else shelf={sheet,y:top,h:d.ph,x:GAP};shelves.push(shelf);}
  const s=sheets[shelf.sheet]!;s.items.push({png:d.png,left:shelf.x,top:shelf.y});s.w=Math.max(s.w,shelf.x+d.pw+GAP);s.h=Math.max(s.h,shelf.y+d.ph+GAP);
  at.set(d.name,[shelf.sheet,shelf.x,shelf.y,d.pw,d.ph]);shelf.x+=d.pw+GAP;
 }
 return {sheets,at};
}
const WEBP={quality:90,alphaQuality:100,effort:6,smartSubsample:true} as const;
async function writeSheets(prefix:string,sheets:ReturnType<typeof pack>['sheets'],dir:URL,webp:object=WEBP){
 const out:string[]=[];
 for(const [i,s] of sheets.entries()){
  const buf=await sharp({create:{width:s.w,height:s.h,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(s.items.map(it=>({input:it.png,left:it.left,top:it.top}))).webp(webp).toBuffer();
  writeFileSync(new URL(`${prefix}-${i}.webp`,dir),buf);out.push(`/harbor/sheets/${prefix}-${i}.webp?v=`+createHash('sha256').update(buf).digest('hex').slice(0,10));
 }
 return out;
}
void (async()=>{
await Promise.all(pending);
const sheetDir=new URL('sheets/',directory);mkdirSync(sheetDir,{recursive:true});
const art=pack(drawings);for(const [name,[sheet,x,y,w,h]] of art.at){assets[name]!.sheet=sheet;assets[name]!.frame=[x,y,w,h];}
const sheetSrc=await writeSheets('harbor',art.sheets,sheetDir);
// the light masks are flat white with soft edges: they compress to almost nothing
const light=pack(masks);
for(const [name,base] of Object.entries(faceSource)){const f=(face:FaceName)=>light.at.get(base+':'+face)!;assets[name]!.faces={front:f('front'),side:f('side'),roof:f('roof')};}
const faceSrc=await writeSheets('light',light.sheets,sheetDir,{quality:80,alphaQuality:90,effort:6});
// Single drawings for the landing's three.js island, which places each one on its own card.
for(const d of drawings)writeFileSync(new URL(d.name+'.webp',directory),await sharp(d.png).webp(WEBP).toBuffer());
writeFileSync(new URL('../components/world/harbor-atlas.ts',import.meta.url),'// Generated by scripts/gen-harbor.tsx from harbor-art.tsx. Do not edit by hand.\nexport const HARBOR_SHEETS = '+JSON.stringify(sheetSrc)+' as const;\nexport const LIGHT_SHEETS = '+JSON.stringify(faceSrc)+' as const;\nexport const HARBOR_ATLAS = '+JSON.stringify(assets)+' as const;\n');
console.log(`Generated ${Object.keys(assets).length} Harbor Street drawings on ${art.sheets.length} sheets, and ${masks.length} light masks on ${light.sheets.length}.`);
})().catch(error=>{console.error(error);process.exit(1);});
