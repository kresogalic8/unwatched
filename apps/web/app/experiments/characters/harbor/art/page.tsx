import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import s from "../../compare/comparison.module.css";
export const metadata:Metadata={title:"Mara · New character art direction",robots:{index:false,follow:false}};
export default function Page(){
 if(process.env.NODE_ENV!=="development")notFound();
 return <main className={s.page}><header className={s.header}><Link href="/">unwatched</Link><Link href="/experiments/characters/harbor/painted">Watch Mara move</Link></header>
 <div className={s.intro}><div><span className={s.eyebrow}>Character art direction · Higgsfield · 01</span><h1>A person, with a story.</h1></div><p>Painted depth. Distinctive features.<br/>The warmth of our island, in a living character.</p></div>
 <a href="/characters/art-direction/mara-higgsfield-v1.png" target="_blank" rel="noreferrer" aria-label="Open full-resolution Mara character sheet" style={{display:"block"}}><img src="/characters/art-direction/mara-higgsfield-v1.png" alt="Mara character concept: ivory linen shirt, coral scarf, teal trousers and brown leather shoes; three-quarter, side and back views, with neutral, smiling, concerned and curious expressions" width="1024" height="688" style={{display:"block",width:"100%",height:"auto",borderRadius:4}}/></a>
 <section className={s.explanation}><h2>The visual target<br/>for our Spine citizens.</h2><div><p>More expressive eyes and brows, believable hands, painted fabric folds, stitched leather and a recognizable silhouette. The front, profile and back views establish a consistent character for the rig.</p><p>The first painted rig is now available locally: separate textured limbs and clothing, planted-foot walking and four head expressions. Additional views and independent facial deformation remain part of the next pass.</p><p className={s.credit}>Any biographical text inside the image is illustrative art direction, not an assigned agent personality. Citizens still make their own choices.</p></div></section>
 </main>;
}
