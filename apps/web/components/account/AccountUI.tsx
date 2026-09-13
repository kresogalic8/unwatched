"use client";
import Link from "next/link";
import { AdminLink } from "@/components/ops/AdminLink";
import { usePathname } from "next/navigation";
import { DigestLayout } from "@/components/digest/DigestLayout";
import { Button as Action, LinkButton, Label } from "@/components/explore/ExplorePage";
import s from "./account.module.css";
export { LinkButton, Label };
export function Page({children,signedIn=true}:{children:React.ReactNode;signedIn?:boolean}) {
 const path=usePathname();
 const title=path==="/account/brain"?"A mind of their own.":path==="/account/credits"?"Room to keep thinking.":"Your corner of the island.";
 return <DigestLayout active="account" signedIn={signedIn}><div className={s.page}><header className={s.hero}><Label>Your account</Label><h1>{title}</h1><p>{path==="/account/brain"?"Choose what powers your citizen’s decisions.":path==="/account/credits"?"Your allowance, your balance, your choice.":"Your citizens, their settings, and how you stay in touch."}</p></header><nav className={s.nav} aria-label="Account settings">{[["/account","Citizens & settings"],["/account/credits","Credits & plan"],["/account/brain","Who thinks"]].map(([href,label])=><Link key={href} href={href!} aria-current={path===href?"page":undefined}>{label}</Link>)}<Link href="/feedback">Your feedback</Link><AdminLink/></nav><div className={s.body}>{children}</div></div></DigestLayout>;
}
export function Card({children,className="",tone}:{children:React.ReactNode;className?:string;tone?:string}) { return <section className={`${s.card} ${className}`}>{children}</section>; }
export function Button({kind="primary",className="",...props}:Omit<React.ComponentProps<typeof Action>,"kind">&{kind?:"primary"|"secondary"|"tertiary"|"leaving"}) { return <Action {...props} kind={kind==="leaving"?"secondary":kind} className={`${kind==="leaving"?s.danger:""} ${className}`}/>; }
export function Chip({children,active=false,onClick}:{children:React.ReactNode;active?:boolean;onClick?:()=>void}) { return onClick?<button type="button" className={s.chip} aria-pressed={active} onClick={onClick}>{children}</button>:<span className={s.chip} data-active={active}>{children}</span>; }
