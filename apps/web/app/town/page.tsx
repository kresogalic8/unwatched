"use client";
import { Icon as ArrowIcon } from "@/components/icons";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ExploreHeader,
  Label,
  Button,
  LinkButton,
} from "@/components/explore/ExplorePage";
import { Bubble, Tide } from "@/components/ui";
import { api, hhmm, type PublicAgent, type OwnerAgent } from "@/lib/api";
import { useMyAgent } from "@/lib/useAgent";
import type { WorldSnapshot } from "@/components/World";
import theme from "@/components/explore/explore.module.css";
import s from "@/components/town/town.module.css";
const World = dynamic(() => import("@/components/World").then((m) => m.World), {
  ssr: false,
  loading: () => (
    <div className={s.loading} role="status">
      Crossing to the island…
    </div>
  ),
});

export default function Town() {
  const { agent, reason } = useMyAgent();
  const [sel, setSel] = useState<PublicAgent | null>(null);
  const [selFull, setSelFull] = useState<OwnerAgent | PublicAgent | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [clean, setClean] = useState(false);
  const [view, setView] = useState<"street" | "map" | "cinema">("street");
  const [follow, setFollow] = useState(true);
  const [effects, setEffects] = useState(true);
  const [nudge, setNudge] = useState(false);
  const [tab, setTab] = useState<"activity" | "people">("activity");
  const [snapshot, setSnapshot] = useState<WorldSnapshot>({
    clock: null,
    feed: [],
    citizens: [],
    ready: false,
    error: false,
  });
  const [possessed, setPossessed] = useState(false);
  const [say, setSay] = useState("");
  const [busy, setBusy] = useState(false);
  const actionPending = useRef(false);
  const [note, setNote] = useState<string | null>(null);
  const visitor = reason === "signed-out" || reason === "none";
  const heading = useRef<HTMLHeadingElement>(null);
  const journalScroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setClean(q.get("clean") === "1");
    const v = q.get("view");
    if (v === "map" || v === "cinema") setView(v);
    if (q.get("fx") === "0") setEffects(false);
    try {
      setNudge(sessionStorage.getItem("ft.nudge") !== "1");
    } catch {
      setNudge(true);
    }
  }, []);
  useEffect(() => {
    let alive = true;
    setSelFull(null);
    setDetailError(false);
    if (sel)
      void api<OwnerAgent | PublicAgent>(`/api/agents/${sel.id}`)
        .then((a) => {
          if (alive) setSelFull(a);
        })
        .catch(() => {
          if (alive) setDetailError(true);
        });
    return () => {
      alive = false;
    };
  }, [sel]);
  useEffect(() => {
    if (sel) heading.current?.focus();
  }, [sel]);
  useEffect(() => { if (journalScroll.current) journalScroll.current.scrollTop = 0; }, [sel, tab]);
  function dismiss() {
    setNudge(false);
    try {
      sessionStorage.setItem("ft.nudge", "1");
    } catch {}
  }
  function changeView(v: typeof view) {
    setView(v);
    const url = new URL(location.href);
    url.searchParams.set("view", v);
    history.replaceState(null, "", url);
  }
  async function act(action: unknown) {
    if (!agent || actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setNote(null);
    try {
      const r = await api<{ ok: boolean }>(`/api/agents/${agent.id}/possess`, {
        method: "POST",
        body: JSON.stringify(action),
      });
      setNote(
        r.ok ? null : `${agent.name.split(" ")[0]} could not do that here.`,
      );
      if (r.ok) setSay("");
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
      actionPending.current = false;
    }
  }
  const rel = agent?.people.find((p) => p.id === sel?.id);
  const c = snapshot.clock;
  return (
    <main className={`${theme.page} ${s.page} ${clean ? s.clean : ""}`}>
      {!clean && (
        <>
          <a className={theme.skip} href="#town-journal">
            Skip to the town journal
          </a>
          <ExploreHeader />
          <div className={s.toolbar}>
            <div className={s.title}>
              <h1>Watch the town.</h1>
              <p className={s.clock}>
                {c
                  ? `Day ${c.day} · ${String(c.hour).padStart(2, "0")}:${String(c.minute % 60).padStart(2, "0")} · ${c.weather}${typeof c.temperatureC === "number" ? ` · ${Math.round(c.temperatureC)}°` : ""} · ${c.population} citizens`
                  : snapshot.error
                    ? "The island is out of reach."
                    : "Finding our way to the island…"}
              </p>
            </div>
            <div className={s.controls}>
              <div
                className={s.segment}
                role="group"
                aria-label="View of the town"
              >
                {(
                  [
                    ["street", "Street"],
                    ["map", "Map"],
                    ["cinema", "Follow the day"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    aria-pressed={view === v}
                    onClick={() => changeView(v)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {agent && (
                <div
                  className={s.segment}
                  role="group"
                  aria-label="Camera follows"
                >
                  <button aria-pressed={follow} onClick={() => setFollow(true)}>
                    Follow {agent.name.split(" ")[0]}
                  </button>
                  <button
                    aria-pressed={!follow}
                    onClick={() => setFollow(false)}
                  >
                    Free camera
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      <div className={s.stage}>
        <section
          className={s.viewport}
          aria-label="The island"
          aria-describedby={clean ? undefined : "town-camera-help"}
        >
          <World
            mineId={follow && agent ? agent.id : null}
            onSelect={setSel}
            view={view}
            effects={effects}
            observer
            onSnapshot={setSnapshot}
          />
        </section>
        {!clean && (
          <aside
            className={s.journal}
            id="town-journal"
            aria-label="Town journal"
          >
            <div className={s.journalHeader}>
              <h2 ref={heading} tabIndex={-1}>
                {sel ? "A life on the island" : "The town journal"}
              </h2>
              {sel ? (
                <button onClick={() => setSel(null)}>Close profile</button>
              ) : (
                <Label>
                  {snapshot.ready ? "From the record" : "Connecting"}
                </Label>
              )}
            </div>
            {!sel && (
              <div className={s.tabs} role="group" aria-label="Journal view">
                <button
                  aria-pressed={tab === "activity"}
                  onClick={() => setTab("activity")}
                >
                  Happening now
                </button>
                <button
                  aria-pressed={tab === "people"}
                  onClick={() => setTab("people")}
                >
                  People{" "}
                  {snapshot.citizens.length > 0
                    ? `(${snapshot.citizens.length})`
                    : ""}
                </button>
              </div>
            )}
            <div className={s.scroll} ref={journalScroll}>
              {!sel && tab === "activity" && (
                <div aria-label="Recent island events">
                  {snapshot.feed.length ? (
                    snapshot.feed.map((e) => (
                      <article
                        key={e.id}
                        className={s.event}
                        data-important={e.importance >= 0.45}
                      >
                        <time>
                          Day {e.day} · {hhmm(e.t)}
                        </time>
                        <p>{e.text}</p>
                      </article>
                    ))
                  ) : (
                    <p className={s.empty}>
                      {snapshot.error
                        ? "The record could not be reached. Try reloading the island."
                        : snapshot.ready
                          ? "A quiet minute on the island. New events will appear here."
                          : "Opening the town record…"}
                    </p>
                  )}
                </div>
              )}
              {!sel && tab === "people" && (
                <div>
                  {[...snapshot.citizens]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((p) => (
                      <button
                        key={p.id}
                        className={s.person}
                        onClick={() => setSel(p)}
                      >
                        <span>
                          <strong>{p.name}</strong>
                          <small>
                            {p.asleep ? "Asleep" : p.place} ·{" "}
                            {p.job ?? "Finding their way"}
                          </small>
                        </span>
                        <span aria-hidden="true"><ArrowIcon name="arrowUpRight" size={20} /></span>
                      </button>
                    ))}
                  {!snapshot.citizens.length && (
                    <p className={s.empty}>
                      {snapshot.ready
                        ? "Nobody is here yet."
                        : "Waiting for the island's people…"}
                    </p>
                  )}
                </div>
              )}
              {sel && (
                <div className={s.details}>
                  <section>
                    <Label>{sel.asleep ? "Asleep" : `At ${sel.place}`}</Label>
                    <h3>{sel.name}</h3>
                    <p className="text-ink2">
                      {sel.job ?? "No work yet"} · arrived day {sel.arrivedDay}
                      {sel.ownerId ? "" : " · house-funded"}
                    </p>
                  </section>
                  {agent && sel.id !== agent.id && (
                    <section>
                      <Label>What {agent.name.split(" ")[0]} knows</Label>
                      {rel ? (
                        <div className="mt-3 flex flex-col gap-3">
                          <Tide
                            name="Trust"
                            trust={rel.trust}
                            word={rel.tide}
                            width={60}
                          />
                          {rel.opinion && (
                            <Bubble max={300}>“{rel.opinion}”</Bubble>
                          )}
                        </div>
                      ) : (
                        <p className="mt-3 text-ink2">
                          They have not met. {agent.name.split(" ")[0]} would
                          have to introduce themselves.
                        </p>
                      )}
                    </section>
                  )}
                  {visitor && (
                    <section>
                      <Label>A person, not an open book</Label>
                      <p className="mt-3 text-ink2">
                        Your citizen gets to know people through time together.
                        Their trust and opinions belong to that relationship.
                      </p>
                    </section>
                  )}
                  {selFull && "persona" in selFull ? (
                    <section>
                      <Label>Only you can see this</Label>
                      <p className="mt-3 text-ink2">
                        {String(selFull.persona.summary)}
                      </p>
                    </section>
                  ) : (
                    <section>
                      <Label>
                        {detailError
                          ? "Details unavailable"
                          : "Still a stranger?"}
                      </Label>
                      <p className="mt-3 text-ink2">
                        {detailError
                          ? "Their details could not be loaded. Close and reopen this profile to try again."
                          : "Their money, their family, where they were last night. Someone would have to ask."}
                      </p>
                    </section>
                  )}
                  <div className={s.detailActions}>
                    {agent && !possessed && (
                      <Button
                        onClick={() => {
                          setPossessed(true);
                          setFollow(true);
                        }}
                        disabled={agent.asleep}
                      >
                        {agent.asleep
                          ? `${agent.name.split(" ")[0]} is asleep`
                          : `Possess ${agent.name.split(" ")[0]}${sel.id !== agent.id ? " and go talk" : ""}`}
                      </Button>
                    )}
                    <LinkButton href={`/agent/${sel.id}`} kind="secondary">
                      Their page ↗
                    </LinkButton>
                  </div>
                </div>
              )}
              {possessed && agent && (
                <section
                  className={s.composer}
                  aria-label="Act as your citizen"
                >
                  <Label>You are {agent.name.split(" ")[0]}</Label>
                  <p className="text-sm text-ink2">
                    {agent.memories[0]?.text ?? "Nothing remembered yet."}
                  </p>
                  <div className={s.actions}>
                    {sel && sel.id !== agent.id && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void act({ kind: "move", to: sel.location })
                        }
                      >
                        Walk to {sel.name.split(" ")[0]}
                      </button>
                    )}
                    {["wait", "work", "sleep"].map((kind) => (
                      <button
                        key={kind}
                        disabled={busy}
                        onClick={() => void act({ kind })}
                      >
                        {kind.charAt(0).toUpperCase() + kind.slice(1)}
                      </button>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (say.trim())
                        void act({
                          kind: "say",
                          ...(sel && sel.id !== agent.id ? { to: sel.id } : {}),
                          text: say.trim(),
                        });
                    }}
                  >
                    <label htmlFor="citizen-speech">
                      {sel && sel.id !== agent.id
                        ? `Say something to ${sel.name}`
                        : "Say something to whoever is here"}
                    </label>
                    <input
                      id="citizen-speech"
                      value={say}
                      onChange={(e) => setSay(e.target.value)}
                      readOnly={busy}
                      placeholder="Your words, their voice"
                    />
                    <Button type="submit" disabled={busy || !say.trim()}>
                      Say it ↗
                    </Button>
                  </form>
                  {note && (
                    <p role="alert" className="text-sm">
                      {note}
                    </p>
                  )}
                  <Button kind="secondary" onClick={() => setPossessed(false)}>
                    Let {agent.name.split(" ")[0]} go
                  </Button>
                </section>
              )}
            </div>
            {visitor && nudge && !sel && (
              <div className={s.invite}>
                <strong>A life here could be yours.</strong>
                <p>
                  Give someone a personality. Let the island give them a story.
                </p>
                <div>
                  <LinkButton href="/board" size={36}>
                    Send someone over ↗
                  </LinkButton>
                  <button onClick={dismiss}>Not now</button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
      {!clean && (
        <div className={s.ownerBar}>
          <span id="town-camera-help">
            Drag to explore · Use + / − to zoom · Select a person or a
            building
          </span>
          <nav aria-label="More from the island">
            <Link href="/evolution">What changed ↗</Link>
            <Link href="/gazette">Read the Gazette ↗</Link>
          </nav>
        </div>
      )}
    </main>
  );
}
