import type { Desire } from "@unwatched/protocol";
import { Icon } from "@/components/icons";
import s from "./desires.module.css";
const day = (t: number) => Math.floor(t / 1440) + 1;
const label = { active: "On their mind", set_aside: "Set aside", fulfilled: "Feels fulfilled" };

export function Desires({ desires, name }: { desires: Desire[]; name: string }) {
  return <section className={s.section} aria-labelledby="desires-title">
    <p className={s.eyebrow}>A life of their own</p>
    <h2 id="desires-title">What {name} wants now</h2>
    <p className={s.intro}>Wants they form through experience. They can pursue them, reconsider, or choose something else.</p>
    {!desires.length ? <p className={s.empty}>Nothing new recorded yet. A meaningful experience may become a lasting desire when they reflect.</p> :
      [...desires].sort((a,b) => Number(b.state === "active") - Number(a.state === "active") || b.updated - a.updated).map(d =>
        <article key={d.id} className={s.desire}>
          <div className={s.meta}><span>{label[d.state]}</span><span>Since day {day(d.since)}</span></div>
          <h3>{d.title}</h3><p>{d.why}</p>
          <details><summary>How this took shape <Icon name="plus" size={16} /></summary>
            <p className={s.note}>Their interpretation of recorded experiences. Feeling fulfilled does not certify a completed project or someone else’s feelings.</p>
            {d.history.slice().reverse().map((h,i) => <div className={s.entry} key={`${h.t}-${i}`}><small>Day {day(h.t)} · {label[h.state]}</small><p>{h.why}</p>{h.evidence.map(e => <blockquote key={e.id}><span>Recorded experience · day {day(e.t)}</span>{e.text}</blockquote>)}</div>)}
          </details>
          {!!d.attempts.length && <details><summary>What they tried <Icon name="plus" size={16} /></summary><p className={s.note}>The citizen linked these actions to this desire. An accepted action is not proof that the desire was achieved.</p>{d.attempts.slice().reverse().map((a,i) => <div key={`${a.t}-${i}`} className={s.entry}><small>Day {day(a.t)} · {a.action.replaceAll("_", " ")} · {a.accepted ? "Accepted by the world" : "Could not carry out"}</small>{a.events.map(e => <p key={e.id}>{e.text}</p>)}</div>)}</details>}
        </article>) }
  </section>;
}
