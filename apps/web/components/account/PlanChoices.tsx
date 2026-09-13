"use client";
import { Icon as ArrowIcon } from "@/components/icons";
import { Button } from "./AccountUI";
import s from "./plans.module.css";
type PlanKey="none"|"visitor"|"resident"|"patron";
type PlanDetails={name:string;price:number;blurb:string;gets:string[]};
export function PlanChoices({plans,current,busy,testMode,onChoose,onManage}:{plans:Record<PlanKey,PlanDetails>;current:PlanKey;busy:boolean;testMode:boolean;onChoose:(key:PlanKey)=>void;onManage:()=>void}) {
 return <div className={s.comparison}>{(["visitor","resident","patron"] as const).map(key=>{const plan=plans[key];const selected=key===current;const verb=current==="none"?"Choose":plan.price>plans[current].price?"Upgrade to":"Switch to";return <article key={key} className={s.plan} data-current={selected}><div className={s.title}><h3>{plan.name}</h3>{selected&&<span className={s.badge}>Current plan</span>}</div><p className={s.price}>${plan.price}<span>/ month</span></p><p className={s.unit}>Per citizen · USD · before tax</p><p className={s.description}>{plan.blurb}</p><ul>{plan.gets.map(benefit=><li key={benefit}><span aria-hidden="true">✓</span>{benefit}</li>)}</ul><div className={s.action}>{selected?<><Button kind="secondary" disabled={busy||testMode} onClick={onManage}>{testMode?"Current plan":"Manage subscription"}</Button><p>{testMode?"Test mode is enabled.":"Billing and cancellation on Stripe."}</p></>:<><Button kind={current==="none"?"primary":"secondary"} disabled={busy} onClick={()=>onChoose(key)}>{verb} {plan.name}<span aria-hidden="true"><ArrowIcon name="arrowUpRight" size={20} /></span></Button><p>{testMode?"Test mode · no card is charged.":"Monthly plan for one citizen."}</p></>}</div></article>;})}</div>;
}
