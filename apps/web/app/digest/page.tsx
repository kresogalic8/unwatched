"use client";
import { Desires } from "@/components/digest/Desires";
import { AnotherYou } from "@/components/digest/AnotherYou";
import { Icon as ArrowIcon } from "@/components/icons";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bubble } from "@/components/ui";
import { Label, LinkButton, Button } from "@/components/explore/ExplorePage";
import { DigestLayout as Page, DigestSection as Card, DigestTimeline as Strip, DigestState } from "@/components/digest/DigestLayout";
import s from "@/components/digest/digest.module.css";
import {
  api,
  clock,
  hhmm,
  dayOf,
  PRIVATE_KINDS,
  type Digest,
  type Paper,
  type TownEvent,
} from "@/lib/api";
import { useMyAgent } from "@/lib/useAgent";

const tideWord = (t: number) =>
  t < 0.2
    ? "gone"
    : t < 0.3
      ? "ebbing"
      : t < 0.45
        ? "steady"
        : t < 0.65
          ? "rising"
          : "close";
/**
 * The window this browser session opened on: kept, so a refresh reads the same days and not the ten minutes since.
 * It ages out after twelve hours, because a citizen gets the same seconds as the reader: a tab left open across the
 * night opens on the new morning, not on the week it was first opened on.
 */
const sinceKey = (id: string) => `ft.since.${id}`;
const KEEP_MS = 12 * 60 * 60 * 1000;

export default function DigestPage() {
  const { agent, reason } = useMyAgent();
  const [d, setD] = useState<Digest | null>(null);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [down, setDown] = useState(false);
  const [unbought, setUnbought] = useState(false);
  useEffect(() => {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get("plan") === "unbought") {
        setUnbought(true);
        history.replaceState(null, "", location.pathname);
      }
    } catch {}
  }, []);
  const load = () => {
    if (!agent) return;
    setDown(false);
    let since: string | null = null;
    try {
      const kept = JSON.parse(
        sessionStorage.getItem(sinceKey(agent.id)) ?? "null",
      ) as { since: number; at: number } | null;
      if (
        kept &&
        typeof kept.since === "number" &&
        Date.now() - kept.at < KEEP_MS
      )
        since = String(kept.since);
      else sessionStorage.removeItem(sinceKey(agent.id));
    } catch {}
    void api<Digest>(
      `/api/agents/${agent.id}/digest${since ? `?since=${encodeURIComponent(since)}` : ""}`,
    )
      .then((x) => {
        try {
          sessionStorage.setItem(
            sinceKey(agent.id),
            JSON.stringify({ since: x.since, at: Date.now() }),
          );
        } catch {}
        setD(x);
      })
      .catch(() => setDown(true));
    void api<Paper>("/api/papers/latest")
      .then(setPaper)
      .catch(() => {});
  };
  useEffect(load, [agent]);
  if (reason === "signed-out")
    return (
      <Page>
        <DigestState
          title="Your story starts here."
          href="/gate?next=%2Fdigest"
          action="Sign in"
        >
          Sign in to read what happened to your citizen, or{" "}
          <Link href="/town" className="underline">
            watch the town
          </Link>{" "}
          without one.
        </DigestState>
      </Page>
    );
  if (reason === "none")
    return (
      <Page>
        <DigestState
          title="Someone to follow."
          href="/board"
          action="Send someone over"
        >
          Give a person a personality and send them to the island. Their journal
          starts here.
        </DigestState>
      </Page>
    );
  if (down)
    return (
      <Page>
        <DigestState title="The island is out of reach.">
          <p>We couldn’t open your journal. Try again in a moment.</p>
          <Button onClick={load}>
            Try again
          </Button>
        </DigestState>
      </Page>
    );
  if (!agent || !d)
    return (
      <Page>
        <DigestState title="Opening your journal…">
          <p role="status">Gathering the latest record from the island.</p>
        </DigestState>
      </Page>
    );
  const first = agent.name.split(" ")[0];
  const changed = d.items.filter((e) => e.importance >= 0.45);
  const top = d.items.length
    ? [...d.items].sort((a, b) => b.importance - a.importance)[0]
    : null;
  const quiet = !top;
  const onHabit = agent.budget.tier1Left === 0 && agent.budget.tier2Left === 0;
  const days = Math.max(1, Math.round((d.now - d.since) / 1440));
  const grouped = d.now - d.since > 3 * 1440; // a long absence reads by the day, not as one strip
  const today = dayOf(d.now);
  const row = (e: TownEvent) => ({
    key: e.id,
    t: grouped
      ? hhmm(e.t)
      : `${dayOf(e.t) === today ? "Today" : `Day ${dayOf(e.t)}`} ${hhmm(e.t)}`,
    changed: e.importance >= 0.45,
    text: (
      <>
        {e.kind === "conversation" ? talk(e.text) : e.text}
        {e.payload?.because ? (
          <span className="block text-[13px] text-drift italic">
            because {String(e.payload.because).replace(/[.]$/, "")}
          </span>
        ) : null}
      </>
    ),
    ...(e.importance >= 0.45 && !PRIVATE_KINDS.has(e.kind)
      ? { share: `/m/${e.id}` }
      : {}),
  });
  const byDay = grouped
    ? [...new Set(d.items.map((e) => dayOf(e.t)))]
        .sort((x, y) => x - y)
        .map((day) => ({
          day,
          items: d.items.filter((e) => dayOf(e.t) === day),
        }))
    : [];
  const canWrite = agent.budget.tier2Max; // a letter home takes a careful decision; a plan with none cannot write
  return (
    <Page name={agent.name}>
      {unbought && (
        <div className={s.notice}>
          <div>
            <div className="font-bold">
              {first} boarded, but the plan was not bought.
            </div>
            <div className="text-[13px] text-ink2">
              Nothing was charged. Until a plan is on the account, {first} lives
              on habit: no thoughts, no letters. The credits page puts that
              right.
            </div>
          </div>
          <div className="flex gap-2">
            <LinkButton href="/account/credits" size={36}>
              Buy the plan
            </LinkButton>
            <Button
              kind="tertiary"
              size={36}
              onClick={() => setUnbought(false)}
            >
              Later
            </Button>
          </div>
        </div>
      )}
      <div className={s.layout}>
        <div className={s.journal}>
          <div className={s.masthead}>
            <Label>
              {d.now - d.since < 720
                ? `Since ${first} arrived`
                : `While you were away · ${days} day${days > 1 ? "s" : ""}`}
            </Label>
            <Link
              href={`/agent/${agent.id}/book`}
              className="text-[13px] font-bold text-teal"
            >
              The whole record
            </Link>
          </div>
          <div>
            <h1 className={s.headline}>
              {onHabit && quiet
                ? `${first} has gone quiet`
                : d.written?.headline
                  ? d.written.headline
                  : quiet
                    ? `Nothing changed for ${first}.`
                    : headline(top!.text, agent.name)}
            </h1>
          </div>
          {d.written?.text && (
            <p className={s.lead} style={{ "--i": 1 } as React.CSSProperties}>
              {d.written.text}
            </p>
          )}
          <p className={s.deck} style={{ "--i": 1 } as React.CSSProperties}>
            {onHabit && quiet
              ? `Out of thoughts for today. ${first} eats, sleeps, works, and greets people by name. That is all.`
              : quiet
                ? `No new moments were recorded for ${first} in this window. The island carries on.`
                : deck(top!.text)}
          </p>
          {onHabit && (
            <div>
              <div className={s.allowance}>
                <b>Wake {first} up.</b> The daily allowance is spent. Credits
                let {first} keep thinking until midnight; nothing is lost either
                way, and the first thought back covers what was missed.{" "}
                <LinkButton href="/account/credits">
                  Buy credits <span aria-hidden="true"><ArrowIcon name="arrowUpRight" size={20} /></span>
                </LinkButton>
              </div>
            </div>
          )}
          {d.items.length === 0 && <div className={s.quietScene}><Image src="/harbor/inn.png" alt="" width={220} height={220} sizes="(max-width: 760px) 140px, 220px" /><div><h2>Between the headlines.</h2><p>New moments will appear here as they become part of {first}’s record.</p></div></div>}
          {grouped ? (
            <div
              className="flex flex-col gap-6"
              style={{ "--i": 2 } as React.CSSProperties}
            >
              {byDay.map(({ day, items }) => (
                <div key={day}>
                  <div className="label pt-2 pb-1 border-b border-line">
                    {day === today ? "Today" : `Day ${day}`}
                  </div>
                  <Strip items={items.map(row)} />
                </div>
              ))}
            </div>
          ) : (
            <div
              className="min-w-0"
              style={{ "--i": 2 } as React.CSSProperties}
            >
              <Strip items={d.items.map(row)} />
            </div>
          )}
          {changed.length === 0 && d.items.length > 0 && (
            <p className="text-sm text-drift">
              Nearby:{" "}
              {d.people
                .slice(0, 2)
                .map((p) => p.name)
                .join(" and ")}{" "}
              were seen about town.
            </p>
          )}
        </div>
        <aside className={s.sidebar}>
          {d.letters.length > 0 && (
            <Card tone="glass">
              <div className="flex justify-between items-baseline">
                <Label tone="teal">A letter from {first}</Label>
                <span className="text-xs text-teal">
                  {clock(d.letters[d.letters.length - 1]!.t)}
                </span>
              </div>
              <p className="italic text-[17px] leading-[1.4]">
                “{d.letters[d.letters.length - 1]!.text}”
              </p>
              <div className={s.actions}>
                <LinkButton href="/letters">Write back</LinkButton>
                <LinkButton href="/town" kind="secondary">
                  Visit
                </LinkButton>
              </div>
            </Card>
          )}
          {d.letters.length === 0 && (
            <Card>
              <Label>Letters</Label>
              <div className="display text-xl font-semibold">Nothing yet.</div>
              <p className="text-sm text-ink2">
                {canWrite === 0
                  ? `On this plan ${first} cannot write home: a letter takes a careful decision, and the plan carries none. You can still write; they read it in the morning.`
                  : canWrite === 1
                    ? `${first} has one careful decision a day, so a letter home is possible but rare. You can write first.`
                    : `${first} writes when something is at stake, usually within the first three days. You can write first.`}
              </p>
              <div className={s.actions}>
                <LinkButton href="/letters">
                  Write to {first}
                </LinkButton>
                {canWrite === 0 && (
                  <Link href="/account/credits" className={s.textAction}>
                    Change the plan <span aria-hidden="true"><ArrowIcon name="arrowUpRight" size={20} /></span>
                  </Link>
                )}
              </div>
            </Card>
          )}
          <Card>
            <div className="flex justify-between items-baseline">
              <Label>People</Label>
              <Link href="/people" className="text-[13px] font-bold text-teal">
                Everyone {first} knows
              </Link>
            </div>
            {agent.people.length ? (
              agent.people.slice(0, 5).map((p) => (
                <Link
                  key={p.id}
                  href={`/people?id=${encodeURIComponent(p.id)}`}
                  className={s.relationship}
                >
                  <span>{p.name}</span>
                  <small>{p.tide}</small>
                </Link>
              ))
            ) : (
              <p className="text-sm text-drift">
                Nobody yet. Trust grows with every conversation, and shrinks
                without them.
              </p>
            )}
          </Card>
          <Desires desires={agent.desires ?? []} name={first ?? agent.name} />
          <AnotherYou agent={agent} />
          {agent.watch?.length ||
          agent.projects?.length ||
          agent.beliefs?.length ? (
            <Card>
              <Label>Who {first} is becoming</Label>
              {agent.watch?.length ? (
                <p className="text-sm">
                  <span className="text-drift">Keeping an eye on: </span>
                  {agent.watch.join(", ")}
                </p>
              ) : null}
              {agent.projects?.filter((x) => !x.done).length ? (
                <div className="text-sm">
                  <span className="text-drift">Working toward: </span>
                  {agent.projects
                    .filter((x) => !x.done)
                    .map((x) => `${x.title} (${x.progress})`)
                    .join("; ")}
                </div>
              ) : null}
              {agent.beliefs?.length ? (
                <div className="text-sm">
                  <span className="text-drift">Believes: </span>
                  {agent.beliefs
                    .map(
                      (b) =>
                        `${b.belief} (${Math.round(b.confidence * 100)}% sure)`,
                    )
                    .join("; ")}
                </div>
              ) : null}
            </Card>
          ) : null}
          <Card>
            <Label>Money and roof</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="display text-2xl font-semibold tabular">
                  {agent.coins}
                </div>
                <div className="text-xs text-drift">coins</div>
              </div>
              <div>
                <div className="display text-2xl font-semibold">
                  {agent.home
                    ? `${agent.nightsPaid} night${agent.nightsPaid === 1 ? "" : "s"}`
                    : "no roof"}
                </div>
                <div className="text-xs text-drift">
                  {agent.home
                    ? `paid at the ${agent.home === "inn" ? "inn" : agent.home}`
                    : "sleeping rough"}
                </div>
              </div>
            </div>
            <div className="text-sm text-ink2">
              {agent.job ? `Works as ${agent.job}.` : "No work yet."}
            </div>
          </Card>
        </aside>
      </div>
      {paper && (
        <div className={s.gazette}>
          <div>
            <h2>The Gazette</h2>
            <div className="text-xs text-drift">Edition {paper.edition}</div>
          </div>
          {[
            { headline: paper.lead.headline, sub: paper.lead.deck },
            ...paper.briefs
              .slice(0, 2)
              .map((b) => ({ headline: b.headline, sub: b.body })),
          ].map((b, i) => (
            <Link key={i} href="/gazette" className="text-sm leading-[1.35]">
              <h3>{b.headline}</h3>
              <p className="line-clamp-3">{b.sub}</p>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}
function headline(t: string, me: string): string {
  const s = t.replace(/[“”"]/g, "").split(/[.!?]/)[0]!;
  return s.length > 70 ? s.slice(0, 68) + "…" : s;
}
function deck(t: string): string {
  const parts = t
    .replace(/[“”]/g, "")
    .split(/[.!?]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts[1] ? parts[1] + "." : "";
}
function talk(t: string): React.ReactNode {
  const m = /^(.+?) and (.+?) talked at (.+?)\. (.*)$/.exec(t);
  if (!m) return t;
  const quote = /“([^”]+)”/.exec(m[4]!)?.[1];
  return (
    <>
      {m[1]} and {m[2]} talked at {m[3]}.
      {quote && (
        <span className="block mt-1">
          <Bubble max={520}>“{quote}”</Bubble>
        </span>
      )}
    </>
  );
}
