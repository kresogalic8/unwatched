"use client";
import { useEffect, useRef, useState } from 'react';
import { Interior, type InteriorPerson } from './Interior';
import { Portrait } from './Portrait';
import s from './BuildingInterior.module.css';

export function hasInterior(kind:string,sprite:string,site:unknown) {
  return !site && (kind==='home' || kind==='inn' || kind==='shop' || kind==='civic' || /house|cottage|bakery|smithy|mill|tavern|chapel|council|boatshed|chandlery|harbor-office/.test(sprite));
}
export function BuildingInterior({name,district,kind,sprite,hour,people,stock,children,onClose,onPerson}:{name:string;district:string;kind:string;sprite:string;hour:number;people:InteriorPerson[];stock?:Record<string,number>;children:React.ReactNode;onClose:()=>void;onPerson:(id:string)=>void}) {
  const close=useRef<HTMLButtonElement>(null), [details,setDetails]=useState(false);
  const onCloseRef=useRef(onClose);onCloseRef.current=onClose;
  useEffect(()=>{const previous=document.activeElement;close.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();onCloseRef.current();}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);if(previous instanceof HTMLElement && previous.isConnected)previous.focus();};},[]);
  return <section className={s.view} aria-label={`Inside ${name}`} data-world-control="interior">
    <header className={s.header}><div><span className={s.eyebrow}>{district} · Inside</span><h2>{name}</h2></div><button ref={close} className={s.back} onClick={onClose}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="m10 5-7 7 7 7M3 12h18"/></svg>Back to the street</button></header>
    <div className={s.room}><Interior kind={kind} sprite={sprite} hour={hour} people={people} stock={stock}/><div className={s.caption}>{people.length ? `${people.length} ${people.length===1?'person':'people'} at this location${people.length>8?' · First 8 shown in the room':''}` : 'A quiet room. Nobody at this location right now.'}</div></div>
    <footer className={s.footer}><div className={s.people}>{people.map(p=><button key={p.id} onClick={()=>onPerson(p.id)} className={s.person}><Portrait name={p.name} appearance={p.appearance} age={p.age??30} size={32}/><span><strong>{p.name}</strong><small>{p.asleep?'Resting':p.pose==='work'?'Working':p.pose==='sit'?'Seated':'At this location'}</small></span></button>)}</div><button className={s.detailsButton} aria-expanded={details} onClick={()=>setDetails(!details)}>About this place <span aria-hidden>{details?'−':'+'}</span></button></footer>
    {details && <div className={s.details}><p className={s.note}>The room is an illustrated view. People and reported activities update from the island; exact indoor positions are not tracked.</p>{children}</div>}
  </section>;
}
