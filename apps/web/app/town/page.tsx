"use client";
import { Inventory } from "@/components/citizen/Inventory";
import { Icon as ArrowIcon } from "@/components/icons";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Label,
  Button,
  LinkButton,
} from "@/components/explore/ExplorePage";
import { SessionLink } from "@/components/auth/SessionLink";
import { Bubble, Tide } from "@/components/ui";
import { api, hhmm, dayOf as dayNumber, PRIVATE_KINDS, type PublicAgent, type OwnerAgent, type TownEvent } from "@/lib/api";
import { Portrait } from "@/components/Portrait";
import { useMyAgent } from "@/lib/useAgent";
import type { WorldSnapshot, RewindControl, RewindState, Photo } from "@/components/World";
import { postcard } from "@/lib/postcard";
import { Film, canFilm, type Take } from "@/lib/film";
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
  const [follow, setFollow] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [tracking, setTracking] = useState<string | null>(null);
  const [effects, setEffects] = useState(true);
  const [nudge, setNudge] = useState(false);
  const [tab, setTab] = useState<"activity" | "people" | "places">("activity");
  const [miniature, setMiniature] = useState(false);
  const [ties, setTies] = useState(false); // the map of who has had to do with whom
  const [hint, setHint] = useState(false);
  const [sheet, setSheet] = useState<"peek" | "open">("peek");
  const [selDay, setSelDay] = useState<TownEvent[]>([]);
  // the day again: the last day of the record played back on the island in about a minute
  const rewindCtl = useRef<RewindControl | null>(null);
  const [rewind, setRewind] = useState<RewindState>(null);
  const [rewinding, setRewinding] = useState(false);
  // the day as a film: the day played back from its start to now, recorded frame by frame, to keep or send
  const frameTap = useRef<((canvas: HTMLCanvasElement) => void) | null>(null);
  const film = useRef<Film | null>(null);
  const rewindNow = useRef<RewindState>(null); rewindNow.current = rewind;
  const [filming, setFilming] = useState(false);
  const [take, setTake] = useState<Take | null>(null);
  const [filmable, setFilmable] = useState(false);
  useEffect(() => { setFilmable(canFilm()); }, []);
  // a postcard of the island as it is on screen, to keep or send
  const photoCtl = useRef<(() => Photo | null) | null>(null);
  const saveCard = useRef<HTMLAnchorElement>(null);
  const [card, setCard] = useState<{ url: string; blob: Blob; name: string; upright: boolean } | null>(null);
  const [snapshot, setSnapshot] = useState<WorldSnapshot>({
    clock: null,
    feed: [],
    citizens: [],
    ready: false,
    error: false,
  });
  const [spotlight, setSpotlight] = useState<{ id: number; actors: string[]; place: string | null; at: number } | null>(null);
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
    let saved: string | null = null, seen: string | null = null;
    try { saved = localStorage.getItem("uw.look"); seen = localStorage.getItem("uw.townHint"); } catch {}
    const look = q.get("look"); setMiniature(look ? look === "miniature" : saved === "miniature");
    setHint(seen !== "1");
    setJournalOpen(true); // a panel on a wide screen, a sheet peeking from the bottom on a phone
    try {
      setNudge(sessionStorage.getItem("ft.nudge") !== "1");
    } catch {
      setNudge(true);
    }
  }, []);
  useEffect(() => {
    let alive = true;
    setSelFull(current => current?.id === sel?.id ? current : null);
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
  }, [sel?.id, snapshot.feed.find(e => e.actors.includes(sel?.id ?? ""))?.id]);
  // their day: what the record says they did since the island's morning, newest first; walking about is left out
  const dayStart = snapshot.clock ? snapshot.clock.t - (snapshot.clock.hour * 60 + (snapshot.clock.minute % 60)) : null;
  useEffect(() => {
    let alive = true; setSelDay([]);
    if (sel && dayStart !== null) void api<TownEvent[]>(`/api/agents/${sel.id}/events?since=${dayStart}`).then((evs) => { if (alive) setSelDay(evs.filter((e) => e.kind !== "agent.move" && e.text).reverse()); }).catch(() => {});
    return () => { alive = false; };
  }, [sel?.id, dayStart, snapshot.feed[0]?.id]);
  useEffect(() => {
    if (sel) heading.current?.focus();
  }, [sel?.id]);
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
  useEffect(() => {setSel(current => current ? snapshot.citizens.find(p=>p.id===current.id) ?? current : null);}, [snapshot.citizens]);
  const rel = agent?.people.find((p) => p.id === sel?.id);
  async function startRewind() {
    if (rewinding) return;
    setRewinding(true); setSel(null); setTracking(null); setFollow(false); setPossessed(false); changeView("cinema");
    try { await rewindCtl.current?.start(24); } catch { setRewinding(false); }
  }
  function startFilming() {
    const r = rewindNow.current; if (!r || filming || !filmable) return;
    const upright = typeof window !== "undefined" && window.innerHeight > window.innerWidth * 1.1;
    const who = tracking ? snapshot.citizens.find((p) => p.id === tracking) : null;
    const title = who ? `A day with ${first(who.name)}` : "A day on the island";
    try { film.current = new Film(upright); } catch { return; }
    frameTap.current = (canvas) => { const now = rewindNow.current; if (film.current && now) film.current.frame(canvas, { day: dayNumber(Math.floor(now.t)), time: hhmm(Math.floor(now.t)), title }); };
    rewindCtl.current?.seek(r.from); rewindCtl.current?.play(); setFilming(true);
  }
  function stopFilming() { frameTap.current = null; film.current?.cancel(); film.current = null; setFilming(false); }
  // the day has played to its end while filming: the clip is done
  useEffect(() => {
    if (!filming || !rewind || rewind.playing || rewind.t < rewind.to || !film.current) return;
    const f = film.current; film.current = null; frameTap.current = null; setFilming(false);
    void f.stop(dayNumber(Math.floor(rewind.to))).then((t) => setTake((old) => { if (old) URL.revokeObjectURL(old.url); return t; }));
  }, [filming, rewind]);
  async function shareTake() {
    if (!take) return; const file = new File([take.blob], take.name, { type: take.blob.type });
    try { if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "A day on the island" }); } catch {}
  }
  function takePostcard() {
    const shot = photoCtl.current?.(); const c = snapshot.clock; if (!shot || !c) return;
    const who = sel ?? (tracking ? snapshot.citizens.find((p) => p.id === tracking) : null);
    const title = who ? `${first(who.name)}, ${who.asleep ? "asleep at" : "at"} ${who.place.replace(/^the /i, "the ")}` : `${shot.place.charAt(0).toUpperCase()}${shot.place.slice(1)}`;
    const sub = `Day ${c.day} · ${String(c.hour).padStart(2, "0")}:${String(c.minute % 60).padStart(2, "0")}${c.weather ? ` · ${c.weather}` : ""}`;
    const drawn = postcard(shot.canvas, { title, sub, day: c.day }); drawn.toBlob((blob) => { if (!blob) return; setCard((old) => { if (old) URL.revokeObjectURL(old.url); return { url: URL.createObjectURL(blob), blob, name: `unwatched-day-${c.day}.png`, upright: drawn.height > drawn.width }; }); }, "image/png");
  }
  useEffect(() => { if (card) saveCard.current?.focus(); }, [card]); // the postcard comes up with its Save in hand, for the keyboard
  async function shareCard() {
    if (!card) return; const file = new File([card.blob], card.name, { type: "image/png" });
    try { if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "A postcard from the island" }); } catch {}
  }
  function stopRewind() { stopFilming(); rewindCtl.current?.stop(); setRewinding(false); changeView("street"); }
  function toggleMiniature() { setMiniature((m) => { try { localStorage.setItem("uw.look", m ? "town" : "miniature"); } catch {} return !m; }); }
  function dismissHint() { setHint(false); try { localStorage.setItem("uw.townHint", "1"); } catch {} }
  function open(person: PublicAgent) { setSel(person); setJournalOpen(true); setSheet("open"); }
  const feed = snapshot.feed.filter((e) => !PRIVATE_KINDS.has(e.kind) && e.text);
  const byId = new Map(snapshot.citizens.map((p) => [p.id, p]));
  const placeName = (id?: string) => (id ? snapshot.citizens.find((p) => p.location === id)?.place ?? id.replace(/[-_]/g, " ") : null);
  const first = (name: string) => name.split(" ")[0];
  const places = [...snapshot.citizens.reduce((m, p) => { const k = p.location; const e = m.get(k) ?? { id: k, name: p.place, people: [] as PublicAgent[] }; e.people.push(p); m.set(k, e); return m; }, new Map<string, { id: string; name: string; people: PublicAgent[] }>()).values()].sort((a, b) => b.people.length - a.people.length);
  const dayOf = sel ? (selDay.length ? selDay : feed.filter((e) => e.actors.includes(sel.id))).filter((e) => !PRIVATE_KINDS.has(e.kind)).slice(0, 8) : [];
  const status = sel ? (sel.asleep ? `Asleep at ${sel.place}` : sel.activity?.kind === "fish" ? `Fishing off ${sel.place}` : sel.activity ? `Working at ${sel.place}` : `At ${sel.place}`) : "";
  const showEvent = (e: TownEvent) => setSpotlight({ id: e.id, actors: e.actors, place: e.place ?? null, at: Date.now() });
  const c = snapshot.clock;
  const sunAt = c ? Math.max(0, Math.min(1, (c.hour + (c.minute % 60) / 60 - 6) / 14)) : 0.5, night = !!c && (c.hour < 6 || c.hour >= 20);
  const views = [["street", "Explore", "street"], ["map", "Whole island", "map"], ["cinema", "Follow the day", "watch"]] as const;
  return (
    <main className={`${theme.page} ${s.page} ${clean ? s.clean : ""}`}>
      {!clean && (
        <a className={theme.skip} href="#town-journal" onClick={() => setJournalOpen(true)}>
          Skip to the town journal
        </a>
      )}
      <section className={s.viewport} aria-label="The island" aria-describedby={clean ? undefined : "town-camera-help"}>
        <World
          mineId={agent?.id ?? null}
          focusId={tracking ?? (follow ? agent?.id ?? null : null)}
          onViewChange={changeView}
          onSelect={(p) => { if (p) open(p); else setSel(null); }}
          selectedId={sel?.id ?? null}
          spotlight={spotlight}
          view={view}
          effects={effects}
          observer
          compact
          miniature={miniature}
          onMiniatureChange={toggleMiniature}
          onSnapshot={setSnapshot}
          rewindControl={rewindCtl}
          photoControl={photoCtl}
          frameTap={frameTap}
          ties={ties}
          onRewind={setRewind}
        />
      </section>
      {!clean && (
        <>
          <header className={s.clockPill}>
            <Link href="/" className={s.mark} aria-label="Unwatched home">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 15V3h12" stroke="currentColor" strokeWidth="2.2" /><circle cx="16" cy="16" r="2" fill="var(--accent)" /></svg>
              <span>unwatched</span>
            </Link>
            <span className={s.rule} aria-hidden="true" />
            <div className={s.time} aria-live="off">
              <svg width="34" height="18" viewBox="0 0 34 18" fill="none" aria-hidden="true" className={s.arc}>
                <path d="M2 16a15 15 0 0 1 30 0" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 3" />
                {night ? <circle cx="17" cy="4" r="3.5" fill="#dfe6f2" /> : <circle cx={17 - 15 * Math.cos(Math.PI * sunAt)} cy={16 - 15 * Math.sin(Math.PI * sunAt)} r="3.5" fill="#f2c14e" />}
              </svg>
              <strong>{c ? `Day ${c.day}` : "Connecting"}</strong>
              <span className={s.clock}>{c ? `${String(c.hour).padStart(2, "0")}:${String(c.minute % 60).padStart(2, "0")}` : "—"}</span>
              {rewinding && <span className={s.replayTag}>The day again</span>}
              <span className={s.weather}>{c?.weather}{typeof c?.temperatureC === "number" ? ` · ${Math.round(c.temperatureC)}°` : ""}</span>
            </div>
          </header>

          {!journalOpen && (
            <button className={s.reopen} onClick={() => setJournalOpen(true)} aria-controls="town-journal">
              <span className={s.faces} aria-hidden="true">{snapshot.citizens.slice(0, 3).map((p) => <Portrait key={p.id} name={p.name} appearance={p.appearance} age={p.age} size={28} />)}</span>
              {snapshot.citizens.length} citizens
            </button>
          )}

          <aside className={s.panel} id="town-journal" aria-label={sel ? sel.name : "Town journal"} hidden={!journalOpen} data-sheet={sheet}>
            <button className={s.handle} aria-label={sheet === "open" ? "Show more of the island" : "Open the journal"} aria-expanded={sheet === "open"} onClick={() => setSheet(sheet === "open" ? "peek" : "open")}><span /></button>
            <div className={s.panelTop}>
              {sel ? (
                <button className={s.back} onClick={() => { setSel(null); setTracking(null); }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" /></svg>Journal
                </button>
              ) : visitor ? (
                <SessionLink className={s.quiet} />
              ) : agent ? (
                <button className={s.back} onClick={() => { open(agent); setTracking(agent.id); changeView("street"); }}>
                  <Portrait name={agent.name} appearance={agent.appearance} age={agent.age} size={28} />{first(agent.name)}
                </button>
              ) : (
                <SessionLink className={s.quiet} />
              )}
              <div className={s.topRight}>
                {visitor && !sel && <Link href="/board" className={s.cta}>Send someone over</Link>}
                <button className={s.iconBtn} aria-label={sel ? "Close profile" : "Close journal"} onClick={() => { if (sel) { setSel(null); setTracking(null); } else setJournalOpen(false); }}>
                  <ArrowIcon name="close" size={16} />
                </button>
              </div>
            </div>

            {!sel && (
              <>
                <div className={s.tabs} role="tablist" aria-label="Journal">
                  {([["activity", "Now"], ["people", `People${snapshot.citizens.length ? ` · ${snapshot.citizens.length}` : ""}`], ["places", "Places"]] as const).map(([t, label]) => (
                    <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setSheet("open"); }}>{label}</button>
                  ))}
                </div>
                <div className={s.scroll} ref={journalScroll}>
                  {tab === "activity" && (
                    <div aria-label="Recent island events" className={s.list}>
                      {feed.length ? (
                        <>
                          <div className={s.listHead}><span>{rewinding ? "As it happened" : "Happening now"}</span><span>Tap one to see it</span></div>
                          {feed.slice(0, 14).map((e, i) => {
                            const who = byId.get(e.actors[0] ?? "");
                            return (
                              <button type="button" key={e.id} className={s.event} data-live={i === 0} data-important={e.importance >= 0.45} onClick={() => showEvent(e)} title="Show this on the island">
                                {who ? <Portrait name={who.name} appearance={who.appearance} age={who.age} size={40} className={s.face} /> : <span className={s.faceBlank} aria-hidden="true" />}
                                <span className={s.eventBody}>
                                  <span className={s.eventText}>{e.text}</span>
                                  <span className={s.meta}>{e.place && <span className={s.chip}>{placeName(e.place)}</span>}<time>Day {e.day} · {hhmm(e.t)}</time></span>
                                </span>
                              </button>
                            );
                          })}
                        </>
                      ) : (
                        <p className={s.empty}>
                          {snapshot.error ? "The record could not be reached. Try reloading the island." : snapshot.ready ? "A quiet minute on the island. New events will appear here." : "Opening the town record…"}
                        </p>
                      )}
                    </div>
                  )}
                  {tab === "people" && (
                    <div className={s.list}>
                      {[...snapshot.citizens].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                        <button key={p.id} className={s.person} onClick={() => open(p)}>
                          <Portrait name={p.name} appearance={p.appearance} age={p.age} size={40} className={s.face} />
                          <span>
                            <strong>{p.name}</strong>
                            <small>{p.asleep ? "Asleep" : p.place} · {p.job ?? "Finding their way"}</small>
                          </span>
                          <span className={s.dot} data-awake={!p.asleep} aria-label={p.asleep ? "asleep" : "awake"} />
                        </button>
                      ))}
                      {!snapshot.citizens.length && <p className={s.empty}>{snapshot.ready ? "Nobody is here yet." : "Waiting for the island's people…"}</p>}
                    </div>
                  )}
                  {tab === "places" && (
                    <div className={s.list}>
                      {places.map((pl) => (
                        <button key={pl.id} className={s.person} onClick={() => setSpotlight({ id: Date.now(), actors: pl.people.map((p) => p.id), place: pl.id, at: Date.now() })}>
                          <span className={s.faces} aria-hidden="true">{pl.people.slice(0, 3).map((p) => <Portrait key={p.id} name={p.name} appearance={p.appearance} age={p.age} size={28} />)}</span>
                          <span><strong>{pl.name}</strong><small>{pl.people.length === 1 ? "1 person" : `${pl.people.length} people`} · {pl.people.slice(0, 3).map((p) => first(p.name)).join(", ")}</small></span>
                        </button>
                      ))}
                      {!places.length && <p className={s.empty}>Waiting for the island's people…</p>}
                    </div>
                  )}
                </div>
                <div className={s.panelFoot}>
                  <Link href="/evolution">The island&rsquo;s history <ArrowIcon name="arrowUpRight" size={16} /></Link>
                  <Link href="/feedback?from=%2Ftown">Feedback</Link>
                </div>
              </>
            )}

            {sel && (
              <div className={s.scroll} ref={journalScroll}>
                <div className={s.profile}>
                  <div className={s.who}>
                    <Portrait name={sel.name} appearance={sel.appearance} age={sel.age} size={80} className={s.bigFace} />
                    <div>
                      <h2 ref={heading} tabIndex={-1}>{sel.name}</h2>
                      <p>{sel.job ?? "No work yet"} · arrived day {sel.arrivedDay}{sel.ownerId ? "" : " · house-funded"}</p>
                    </div>
                  </div>
                  <div className={s.status}><span className={s.dot} data-awake={!sel.asleep} aria-hidden="true" /><span>{status}</span></div>
                  <div className={s.primary}>
                    <button className={s.ctaBig} onClick={() => { setTracking(tracking === sel.id ? null : sel.id); setFollow(false); changeView("street"); setSheet("peek"); }}>{tracking === sel.id ? "Stop following" : `Follow ${first(sel.name)}`}</button>
                    <Link href={`/agent/${sel.id}`} className={s.secondary}>Their page <ArrowIcon name="arrowUpRight" size={16} /></Link>
                  </div>
                  {agent && !possessed && (
                    <button className={s.secondaryWide} onClick={() => { setPossessed(true); setFollow(true); }} disabled={agent.asleep}>
                      {agent.asleep ? `${first(agent.name)} is asleep` : `Possess ${first(agent.name)}${sel.id !== agent.id ? " and go talk" : ""}`}
                    </button>
                  )}

                  <section>
                    <Label>{sel.asleep ? "Their day" : "Their day so far"}</Label>
                    {dayOf.length ? (
                      <ol className={s.timeline}>
                        {dayOf.map((e, i) => (
                          <li key={e.id}><time>{hhmm(e.t)}</time><span className={s.tick} data-now={i === 0} aria-hidden="true" /><button type="button" onClick={() => showEvent(e)}>{e.text}</button></li>
                        ))}
                      </ol>
                    ) : <p className={s.empty}>Nothing on the record for them yet today.</p>}
                  </section>

                  {agent && sel.id !== agent.id && (
                    <section>
                      <Label>What {first(agent.name)} knows</Label>
                      {rel ? (
                        <div className="mt-3 flex flex-col gap-3">
                          <Tide name="Trust" trust={rel.trust} word={rel.tide} width={60} />
                          {rel.opinion && <Bubble max={300}>“{rel.opinion}”</Bubble>}
                        </div>
                      ) : (
                        <p className={s.muted}>They have not met. {first(agent.name)} would have to introduce themselves.</p>
                      )}
                    </section>
                  )}
                  {selFull && "persona" in selFull ? (
                    <section>
                      <Label>Only you can see this</Label>
                      <p className={s.muted}>{String(selFull.persona.summary)}</p>
                    </section>
                  ) : (
                    <div className={s.locked}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" /><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" /></svg>
                      <div>
                        <p>{detailError ? "Their details could not be loaded. Close and reopen this profile to try again." : `Their trust, money and family stay private. ${visitor ? "A citizen of yours" : "Your citizen"} learns them by spending time with ${first(sel.name)}.`}</p>
                        {visitor && <Link href="/board">Send someone over to meet {first(sel.name)}</Link>}
                      </div>
                    </div>
                  )}
                  {selFull && "belongings" in selFull && selFull.belongings && <Inventory data={selFull.belongings} />}
                </div>
              </div>
            )}

            {possessed && agent && (
              <section className={s.composer} aria-label="Act as your citizen">
                <Label>You are {first(agent.name)}</Label>
                <p className={s.muted}>{agent.memories[0]?.text ?? "Nothing remembered yet."}</p>
                <div className={s.actions}>
                  {sel && sel.id !== agent.id && <button disabled={busy} onClick={() => void act({ kind: "move", to: sel.location })}>Walk to {first(sel.name)}</button>}
                  {["wait", "work", "sleep"].map((kind) => <button key={kind} disabled={busy} onClick={() => void act({ kind })}>{kind.charAt(0).toUpperCase() + kind.slice(1)}</button>)}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); if (say.trim()) void act({ kind: "say", ...(sel && sel.id !== agent.id ? { to: sel.id } : {}), text: say.trim() }); }}>
                  <label htmlFor="citizen-speech">{sel && sel.id !== agent.id ? `Say something to ${sel.name}` : "Say something to whoever is here"}</label>
                  <input id="citizen-speech" value={say} onChange={(e) => setSay(e.target.value)} readOnly={busy} placeholder="Your words, their voice" />
                  <Button type="submit" disabled={busy || !say.trim()}>Say it ↗</Button>
                </form>
                {note && <p role="alert" className="text-sm">{note}</p>}
                <Button kind="secondary" onClick={() => setPossessed(false)}>Let {first(agent.name)} go</Button>
              </section>
            )}

            {visitor && nudge && !sel && (
              <div className={s.invite}>
                <strong>A life here could be yours.</strong>
                <p>Give someone a personality. Let the island give them a story.</p>
                <button onClick={dismiss}>Not now</button>
              </div>
            )}
          </aside>

          {rewinding && (
            <div className={s.rewind} role="group" aria-label="The last day, played back" data-panel={journalOpen}>
              <button className={s.play} aria-label={rewind?.playing ? "Pause" : "Play"} disabled={!rewind} onClick={() => rewind?.playing ? rewindCtl.current?.pause() : rewindCtl.current?.play()}>
                <ArrowIcon name={rewind?.playing ? "pause" : "play"} size={20} />
              </button>
              <span className={s.rewindTime} aria-live="off">{rewind ? `Day ${dayNumber(Math.floor(rewind.t))} · ${hhmm(Math.floor(rewind.t))}` : "Fetching the day…"}</span>
              <div className={s.track}>
                {rewind && rewind.marks.map((m, i) => (
                  <button key={i} className={s.moment} style={{ left: `${((m.t - rewind.from) / Math.max(1, rewind.to - rewind.from)) * 100}%` }} data-big={m.importance >= 0.8} title={`${hhmm(m.t)} · ${m.text}`} aria-label={`${hhmm(m.t)}: ${m.text}`} onClick={() => rewindCtl.current?.seek(m.t - 20)} />
                ))}
                <input type="range" aria-label="Time of day" min={rewind?.from ?? 0} max={rewind?.to ?? 1} step={1} value={Math.floor(rewind?.t ?? 0)} disabled={!rewind}
                  aria-valuetext={rewind ? `Day ${dayNumber(Math.floor(rewind.t))}, ${hhmm(Math.floor(rewind.t))}` : undefined}
                  onChange={(e) => rewindCtl.current?.seek(Number(e.target.value))} />
              </div>
              {filmable && <button className={s.filmBtn} onClick={startFilming} disabled={!rewind || filming} aria-label={filming ? "Filming the day" : "Film this day"} title="Play the day from its start and keep it as a film">{filming ? <span className={s.recDot} aria-hidden="true" /> : <ArrowIcon name="film" size={20} />}<span className={s.liveLong}>{filming ? "Filming" : "Film it"}</span></button>}
              <button className={s.live} onClick={stopRewind} aria-label="Back to live"><span className={s.liveDot} aria-hidden="true" /><span className={s.liveLong}>Back to live</span><span className={s.liveShort}>Live</span></button>
            </div>
          )}

          <nav className={s.views} aria-label="View of the town" data-panel={journalOpen} hidden={rewinding}>
            {views.map(([v, label, icon]) => (
              <button key={v} aria-pressed={view === v} aria-label={label} onClick={() => { setTracking(null); setFollow(false); changeView(v); }}>
                <ArrowIcon name={icon} size={20} /><span>{label}</span>
              </button>
            ))}
            <button aria-pressed={miniature} aria-label="Miniature" onClick={toggleMiniature}>
              <ArrowIcon name="model" size={20} /><span>Miniature</span>
            </button>
            <button aria-pressed={ties} aria-label="Ties" title="Who has had to do with whom this week" onClick={() => setTies((t) => !t)}>
              <ArrowIcon name="ties" size={20} /><span>Ties</span>
            </button>
            <span className={s.navRule} aria-hidden="true" />
            <button aria-label="Postcard" title="Make a postcard of what you see" onClick={takePostcard}>
              <ArrowIcon name="postcard" size={20} /><span>Postcard</span>
            </button>
            <button aria-label="The last day again" title="Play the last day back in a minute" onClick={() => void startRewind()}>
              <ArrowIcon name="rewind" size={20} /><span>The day again</span>
            </button>
          </nav>

          {take && (
            <div className={s.cardBack} role="dialog" aria-modal="true" aria-label="Your film of the day" onClick={(e) => { if (e.target === e.currentTarget) setTake(null); }} onKeyDown={(e) => { if (e.key === "Escape") setTake(null); }}>
              <div className={s.card}>
                <video src={take.url} data-upright={take.upright} className={s.filmClip} controls autoPlay muted loop playsInline />
                <div className={s.cardActions}>
                  <a className={s.ctaBig} href={take.url} download={take.name}><ArrowIcon name="download" size={20} />Save the film</a>
                  {typeof navigator !== "undefined" && "canShare" in navigator && <button className={s.secondary} onClick={() => void shareTake()}><ArrowIcon name="share" size={20} />Send it</button>}
                  <button className={s.secondary} onClick={() => setTake(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {card && (
            <div className={s.cardBack} role="dialog" aria-modal="true" aria-label="Your postcard" onClick={(e) => { if (e.target === e.currentTarget) setCard(null); }} onKeyDown={(e) => { if (e.key === "Escape") setCard(null); }}>
              <div className={s.card}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.url} data-upright={card.upright} alt="A postcard of the island as it looked a moment ago" />
                <div className={s.cardActions}>
                  <a className={s.ctaBig} href={card.url} download={card.name} ref={saveCard}><ArrowIcon name="download" size={20} />Save the postcard</a>
                  {typeof navigator !== "undefined" && "canShare" in navigator && <button className={s.secondary} onClick={() => void shareCard()}><ArrowIcon name="share" size={20} />Send it</button>}
                  <button className={s.secondary} onClick={() => setCard(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {ties && !rewinding && (
            <div className={s.legend} data-panel={journalOpen} aria-label="What the lines mean">
              <span><i style={{ background: "#f1e6c8" }} />Talked</span><span><i style={{ background: "#9fd08a" }} />Gave</span><span><i style={{ background: "#f29bb0" }} />Married</span><span><i className={s.feud} />Took or accused</span>
              <small>{sel ? `${first(sel.name)}'s ties this week` : "This week, from the public record · pick someone to see theirs"}</small>
            </div>
          )}

          {hint && (
            <div className={s.hint} id="town-camera-help" data-panel={journalOpen}>
              <span>Drag to look around · scroll or pinch to zoom · click anyone</span>
              <button aria-label="Dismiss the tip" onClick={dismissHint}><ArrowIcon name="close" size={16} /></button>
            </div>
          )}
          {!hint && <span id="town-camera-help" hidden>Drag to look around, scroll or pinch to zoom, click anyone.</span>}
        </>
      )}
    </main>
  );
}
