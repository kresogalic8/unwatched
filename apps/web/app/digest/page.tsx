"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Page, Card, Label, Dot, Strip, Bubble, Tide, LinkButton, Button } from "@/components/ui";
import { api, clock, hhmm, dayOf, PRIVATE_KINDS, type Digest, type Paper, type TownEvent } from "@/lib/api";
import { useMyAgent } from "@/lib/useAgent";
import { Loading, Offline, SignedOut, NoAgent } from "@/components/states";

const tideWord = (t: number) => t < 0.2 ? "gone" : t < 0.3 ? "ebbing" : t < 0.45 ? "steady" : t < 0.65 ? "rising" : "close";
/** The window this browser session opened on: kept, so a refresh reads the same days and not the ten minutes since. */
const sinceKey = (id: string) => `ft.since.${id}`;

export default function DigestPage() {
  const { agent, reason } = useMyAgent();
  const [d, setD] = useState<Digest | null>(null); const [paper, setPaper] = useState<Paper | null>(null); const [down, setDown] = useState(false);
  const [unbought, setUnbought] = useState(false);
  useEffect(() => { try { const q = new URLSearchParams(location.search); if (q.get("plan") === "unbought") { setUnbought(true); history.replaceState(null, "", location.pathname); } } catch {} }, []);
  const load = () => {
    if (!agent) return; setDown(false);
    let since: string | null = null; try { since = sessionStorage.getItem(sinceKey(agent.id)); } catch {}
    void api<Digest>(`/api/agents/${agent.id}/digest${since ? `?since=${encodeURIComponent(since)}` : ""}`).then((x) => { try { sessionStorage.setItem(sinceKey(agent.id), String(x.since)); } catch {} setD(x); }).catch(() => setDown(true));
    void api<Paper>("/api/papers/latest").then(setPaper).catch(() => {});
  };
  useEffect(load, [agent]);
  if (reason === "signed-out") return <Page><SignedOut what="Sign in to read what happened to your agent, or watch the town without one." /></Page>;
  if (reason === "none") return <Page><NoAgent what="Send a person to the island and the digest starts tomorrow morning." /></Page>;
  if (down) return <Page><Offline retry={load} /></Page>;
  if (!agent || !d) return <Page><Loading /></Page>;
  const first = agent.name.split(" ")[0];
  const changed = d.items.filter((e) => e.importance >= 0.45);
  const top = d.items.length ? [...d.items].sort((a, b) => b.importance - a.importance)[0] : null;
  const quiet = !top;
  const onHabit = agent.budget.tier1Left === 0 && agent.budget.tier2Left === 0;
  const days = Math.max(1, Math.round((d.now - d.since) / 1440));
  const grouped = d.now - d.since > 3 * 1440; // a long absence reads by the day, not as one strip
  const today = dayOf(d.now);
  const row = (e: TownEvent) => ({ key: e.id, t: grouped ? hhmm(e.t) : `${dayOf(e.t) === today ? "Today" : `Day ${dayOf(e.t)}`} ${hhmm(e.t)}`, changed: e.importance >= 0.45, text: <>{e.kind === "conversation" ? talk(e.text) : e.text}{e.payload?.because ? <span className="block text-[13px] text-drift italic">because {String(e.payload.because).replace(/[.]$/, "")}</span> : null}</>, ...(e.importance >= 0.45 && !PRIVATE_KINDS.has(e.kind) ? { share: `/m/${e.id}` } : {}) });
  const byDay = grouped ? [...new Set(d.items.map((e) => dayOf(e.t)))].sort((x, y) => x - y).map((day) => ({ day, items: d.items.filter((e) => dayOf(e.t) === day) })) : [];
  const canWrite = agent.budget.tier2Max; // a letter home takes a careful decision; a plan with none cannot write
  return (
    <Page>
      {unbought && <div className="bg-sand rounded-card px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rise"><div><div className="font-bold">{first} boarded, but the plan was not bought.</div><div className="text-[13px] text-ink2">Nothing was charged. Until a plan is on the account, {first} lives on habit: no thoughts, no letters. The credits page puts that right.</div></div><div className="flex gap-2"><LinkButton href="/account/credits" size={36}>Buy the plan</LinkButton><Button kind="tertiary" size={36} onClick={() => setUnbought(false)}>Later</Button></div></div>}
      <div className="grid gap-5 grow grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="bg-shell rounded-[28px] px-5 py-6 sm:px-10 sm:py-9 flex flex-col gap-5 rise">
          <div className="flex justify-between items-baseline gap-3 flex-wrap"><Label>{d.now - d.since < 720 ? `Since ${first} arrived` : `While you were away · ${days} day${days > 1 ? "s" : ""}`}</Label><Link href={`/agent/${agent.id}/book`} className="text-[13px] font-bold text-teal">The whole record</Link></div>
          <div className="flex items-center gap-3.5">{(!quiet || onHabit) && <Dot changed size={14} />}<h1 className="text-[30px] sm:text-[44px] font-bold">{onHabit && quiet ? `${first} has gone quiet` : d.written?.headline ? d.written.headline : quiet ? `Nothing changed for ${first}.` : headline(top!.text, agent.name)}</h1></div>
          {d.written?.text && <p className="text-[19px] leading-[1.45] text-kelp pl-7 max-w-[62ch] rise" style={{ "--i": 1 } as React.CSSProperties}>{d.written.text}</p>}
          <p className="text-xl text-ink2 pl-7 rise" style={{ "--i": 1 } as React.CSSProperties}>{onHabit && quiet ? `Out of thoughts for today. ${first} eats, sleeps, works, and greets people by name. That is all.` : quiet ? `${first} worked, ate at the inn, and slept. No coral today, and that is allowed.` : deck(top!.text)}</p>
          {onHabit && <div className="pl-7"><div className="bg-glass rounded-[18px] p-4 text-sm max-w-[560px]"><b>Wake {first} up.</b> The daily allowance is spent. Credits let {first} keep thinking until midnight; nothing is lost either way, and the first thought back covers what was missed. <a href="/account/credits" className="font-bold text-teal">Buy credits</a></div></div>}
          {grouped
            ? <div className="pl-0 sm:pl-7 flex flex-col gap-2 rise" style={{ "--i": 2 } as React.CSSProperties}>{byDay.map(({ day, items }) => <div key={day}><div className="label pt-2 pb-1 border-b border-line">{day === today ? "Today" : `Day ${day}`}</div><Strip items={items.map(row)} /></div>)}</div>
            : <div className="pl-0 sm:pl-7 rise" style={{ "--i": 2 } as React.CSSProperties}><Strip items={d.items.map(row)} /></div>}
          {changed.length === 0 && d.items.length > 0 && <p className="text-sm text-drift pl-7">Nearby: {d.people.slice(0, 2).map((p) => p.name).join(" and ")} were seen about town.</p>}
        </div>
        <div className="flex flex-col gap-4">
          {d.letters.length > 0 && <Card tone="glass"><div className="flex justify-between items-baseline"><Label tone="teal">A letter from {first}</Label><span className="text-xs text-teal">{clock(d.letters[d.letters.length - 1]!.t)}</span></div><p className="italic text-[17px] leading-[1.4]">“{d.letters[d.letters.length - 1]!.text}”</p><div className="flex gap-2.5"><LinkButton href="/letters">Write back</LinkButton><LinkButton href="/town" kind="tertiary">Visit</LinkButton></div></Card>}
          {d.letters.length === 0 && <Card><Label>Letters</Label><div className="display text-xl font-semibold">Nothing yet.</div><p className="text-sm text-ink2">{canWrite === 0 ? `On this plan ${first} cannot write home: a letter takes a careful decision, and the plan carries none. You can still write; they read it in the morning.` : canWrite === 1 ? `${first} has one careful decision a day, so a letter home is possible but rare. You can write first.` : `${first} writes when something is at stake, usually within the first three days. You can write first.`}</p><div className="flex gap-2 flex-wrap"><LinkButton href="/letters" kind="secondary" size={36}>Write to {first}</LinkButton>{canWrite === 0 && <LinkButton href="/account/credits" kind="tertiary" size={36}>Change the plan</LinkButton>}</div></Card>}
          <Card><div className="flex justify-between items-baseline"><Label>People</Label><Link href="/people" className="text-[13px] font-bold text-teal">Everyone {first} knows</Link></div>{agent.people.length ? agent.people.slice(0, 5).map((p) => <Link key={p.id} href="/people" className="block rounded-xl -mx-2 px-2 py-0.5 hover:bg-glass transition-colors"><Tide name={p.name} trust={p.trust} word={p.tide} /></Link>) : <p className="text-sm text-drift">Nobody yet. Trust grows with every conversation, and shrinks without them.</p>}</Card>
          {(agent.watch?.length || agent.selves?.length || agent.projects?.length || agent.beliefs?.length) ? <Card><Label>Who {first} is becoming</Label>{agent.watch?.length ? <p className="text-sm"><span className="text-drift">Keeping an eye on: </span>{agent.watch.join(", ")}</p> : null}{agent.projects?.filter((x) => !x.done).length ? <div className="text-sm"><span className="text-drift">Working toward: </span>{agent.projects.filter((x) => !x.done).map((x) => `${x.title} (${x.progress})`).join("; ")}</div> : null}{agent.beliefs?.length ? <div className="text-sm"><span className="text-drift">Believes: </span>{agent.beliefs.map((b) => `${b.belief} (${Math.round(b.confidence * 100)}% sure)`).join("; ")}</div> : null}{agent.selves?.length ? <details className="text-sm"><summary className="cursor-pointer text-ink2">{agent.selves.length === 1 ? "Rewrote themself once" : `Rewrote themself ${agent.selves.length} times`}; now wants {String(agent.persona.want ?? "")}</summary>{agent.selves.slice().reverse().map((sv) => <div key={sv.day} className="mt-2 pl-3 border-l border-line"><div className="text-xs text-drift">until day {sv.day}</div><div>wanted {sv.want} · feared {sv.fear}</div></div>)}</details> : null}</Card> : null}
          <Card><Label>Money and roof</Label><div className="grid grid-cols-2 gap-3"><div><div className="display text-2xl font-semibold tabular">{agent.coins}</div><div className="text-xs text-drift">coins</div></div><div><div className="display text-2xl font-semibold">{agent.home ? `${agent.nightsPaid} night${agent.nightsPaid === 1 ? "" : "s"}` : "no roof"}</div><div className="text-xs text-drift">{agent.home ? `paid at the ${agent.home === "inn" ? "inn" : agent.home}` : "sleeping rough"}</div></div></div><div className="text-sm text-ink2">{agent.job ? `Works as ${agent.job}.` : "No work yet."}</div></Card>
        </div>
      </div>
      {paper && <div className="bg-shell rounded-card px-7 py-4 grid gap-4 sm:gap-7 items-center grid-cols-1 md:grid-cols-[180px_repeat(3,minmax(0,1fr))]"><div><div className="display text-lg font-semibold">The Gazette</div><div className="text-xs text-drift">Edition {paper.edition}</div></div>{[{ headline: paper.lead.headline, sub: paper.lead.deck }, ...paper.briefs.slice(0, 2).map((b) => ({ headline: b.headline, sub: b.body }))].map((b, i) => <Link key={i} href="/gazette" className="text-sm leading-[1.35]"><div className="font-bold">{b.headline}</div><div className="text-drift line-clamp-1">{b.sub}</div></Link>)}</div>}
    </Page>
  );
}
function headline(t: string, me: string): string { const s = t.replace(/[“”"]/g, "").split(/[.!?]/)[0]!; return s.length > 70 ? s.slice(0, 68) + "…" : s; }
function deck(t: string): string { const parts = t.replace(/[“”]/g, "").split(/[.!?]/).map((s) => s.trim()).filter(Boolean); return parts[1] ? parts[1] + "." : ""; }
function talk(t: string): React.ReactNode { const m = /^(.+?) and (.+?) talked at (.+?)\. (.*)$/.exec(t); if (!m) return t; const quote = /“([^”]+)”/.exec(m[4]!)?.[1]; return <>{m[1]} and {m[2]} talked at {m[3]}.{quote && <span className="block mt-1"><Bubble max={520}>“{quote}”</Bubble></span>}</>; }
