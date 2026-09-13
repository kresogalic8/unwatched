"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CitizenPage } from "@/components/citizen/CitizenPage";
import { Label, Button, LinkButton } from "@/components/explore/ExplorePage";
import s from "@/components/citizen/citizen.module.css";
import { Portrait } from "@/components/Portrait";
import { api, hhmm, dayOf, type TownEvent, type Life } from "@/lib/api";

type Book = {
  id: string;
  name: string;
  persona: Record<string, unknown>;
  arrivedT: number;
  leftT: number | null;
  events: TownEvent[];
  memories: { t: number; kind: string; text: string; importance: number }[];
  letters: { direction: string; text: string; t: number }[];
};
export default function BookPage() {
  const { id } = useParams<{ id: string }>();
  const [b, setB] = useState<Book | null>(null);
  const [err, setErr] = useState("");
  const [day, setDay] = useState<number | null>(null);
  const [life, setLife] = useState<Life | null>(null);
  const [eventCount, setEventCount] = useState(20);
  useEffect(() => {
    setEventCount(20);
  }, [day, id]);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setB(null);
    setErr("");
    setLife(null);
    setDay(null);
    void api<Book>(`/api/agents/${id}/book`)
      .then((value) => {
        if (active) setB(value);
      })
      .catch(() => {
        if (active)
          setErr(
            "This book couldn’t be opened. Sign in with the account that owns this citizen, or try again.",
          );
      });
    void api<Life>(`/api/library/${id}`)
      .then((value) => {
        if (active) setLife(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, attempt]);
  if (!b)
    return (
      <CitizenPage>
        <div className={s.empty} role={err ? "alert" : "status"}>
          {err || "Opening the book…"}
        </div>
        {err && (
          <div className={s.actions}>
            <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
            <LinkButton
              href={`/gate?next=${encodeURIComponent(`/agent/${id}/book`)}`}
              kind="secondary"
            >
              Sign in
            </LinkButton>
            <LinkButton href={`/agent/${id}`} kind="secondary">
              Citizen profile
            </LinkButton>
          </div>
        )}
      </CitizenPage>
    );
  const first = b.name.split(" ")[0];
  const days = [
    ...new Set([
      dayOf(b.arrivedT),
      ...b.events.map((e) => dayOf(e.t)),
      ...b.memories.map((m) => dayOf(m.t)),
      ...b.letters.map((l) => dayOf(l.t)),
    ]),
  ].sort((x, y) => x - y);
  const cur = day ?? days[days.length - 1] ?? dayOf(b.arrivedT);
  const index = days.indexOf(cur);
  const evs = b.events.filter(
    (e) =>
      dayOf(e.t) === cur && e.importance >= 0.25 && e.kind !== "agent.reflect",
  );
  const refl = b.memories.filter(
    (m) => dayOf(m.t) === cur && m.kind === "reflect",
  );
  const letters = b.letters.filter((l) => dayOf(l.t) === cur);
  return (
    <CitizenPage signedIn>
      <nav className={s.breadcrumb} aria-label="Breadcrumb">
        <Link href={`/agent/${id}`}>{b.name}</Link>
        <span>/</span>
        <span>Life book</span>
      </nav>
      <section className={s.hero}>
        <Portrait
          name={b.name}
          appearance={(b.persona.appearance as Record<string, unknown>) ?? null}
          age={Number(b.persona.age ?? 30)}
          size={180}
        />
        <div>
          <Label>A life, kept on the record</Label>
          <h1>The book of {first}.</h1>
          <p className={s.meta}>
            Day {dayOf(b.arrivedT)} to{" "}
            {b.leftT !== null ? `day ${dayOf(b.leftT)}` : "today"} ·{" "}
            {b.memories.length} memories · {b.letters.length} letters
          </p>
          <div className={s.actions}>
            <LinkButton href={`/agent/${id}`} kind="secondary">
              Citizen profile
            </LinkButton>
            {b.leftT === null && (
              <LinkButton href="/digest">Back to today</LinkButton>
            )}
          </div>
        </div>
        <div className={s.status}>
          <Label>Private life book</Label>
          <p className={s.meta}>
            Memories, letters and moments from {first}’s days on the island.
          </p>
        </div>
      </section>
      {life?.text && (
        <section className={s.library}>
          <Label>On the library shelf · written by the town</Label>
          <h2>{life.title}</h2>
          <p>
            <i>{life.epitaph}</i>
          </p>
          {life.text.split(/\n\n+/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <LinkButton href="/library" kind="secondary">
            Visit the library
          </LinkButton>
        </section>
      )}
      <div className={s.bookGrid}>
        <aside>
          <Label>Days on the record</Label>
          <nav className={s.dayNav} aria-label="Choose a day">
            {days.map((d) => (
              <button
                key={d}
                aria-current={d === cur ? "date" : undefined}
                aria-controls="book-day"
                onClick={() => setDay(d)}
              >
                Day {d}
              </button>
            ))}
          </nav>
        </aside>
        <article
          id="book-day"
          className={s.reading}
          aria-live="polite"
          aria-atomic="false"
        >
          <Label>Day {cur}</Label>
          <h2>
            {refl[0]?.text.split(/[.!?]/)[0] ||
              evs[0]?.text.split(/[.!?]/)[0] ||
              (letters.length ? "A letter across the water" : "A quiet day")}
            .
          </h2>
          {refl.slice(0, 3).map((r, i) => (
            <blockquote key={i} className={s.reflection}>
              {r.text}
            </blockquote>
          ))}
          {refl.length > 3 && (
            <details key={cur} className={s.more}>
              <summary>Read {refl.length - 3} more reflections</summary>
              {refl.slice(3).map((r, i) => (
                <blockquote key={i} className={s.reflection}>
                  {r.text}
                </blockquote>
              ))}
            </details>
          )}
          <div className={s.timeline}>
            {evs.slice(0, eventCount).map((e) => (
              <div className={s.event} key={e.id}>
                <time>{hhmm(e.t)}</time>
                <p>{e.text}</p>
              </div>
            ))}
          </div>
          {evs.length > eventCount && (
            <Button
              kind="secondary"
              onClick={() => setEventCount((n) => n + 20)}
            >
              Read more moments ({evs.length - eventCount} remaining)
            </Button>
          )}
          {!evs.length && !refl.length && (
            <p className={s.empty}>
              {letters.length
                ? "No street moments or reflections recorded. The day’s letters are alongside this page."
                : "Nothing on the record for this day."}
            </p>
          )}
          <div className={s.pager}>
            <Button
              kind="secondary"
              disabled={index === 0}
              onClick={() => setDay(days[index - 1] ?? cur)}
            >
              ← Earlier
            </Button>
            <Button
              kind="secondary"
              disabled={index === days.length - 1}
              onClick={() => setDay(days[index + 1] ?? cur)}
            >
              Later →
            </Button>
          </div>
          <p className={s.note}>
            Written from memories, letters and events recorded on the island.
          </p>
        </article>
        <aside className={s.sidebar} aria-label="Letters and private notes">
          <div>
            <Label>Letters · day {cur}</Label>
            {!letters.length && <p className={s.empty}>No letters this day.</p>}
            {letters.map((l, i) => (
              <div className={s.letter} key={`${cur}:${i}`}>
                <Label>
                  {l.direction === "to_agent"
                    ? `You → ${first}`
                    : `${first} → You`}{" "}
                  · {hhmm(l.t)}
                </Label>
                <p>{l.text}</p>
              </div>
            ))}
          </div>
          <div className={s.private}>
            <Label>The secret · only you</Label>
            <p>{String(b.persona.secret ?? "") || "No secret recorded."}</p>
            <p className={s.note}>
              {b.leftT !== null
                ? "It left with them."
                : "Still a secret, as far as the record shows."}
            </p>
          </div>
        </aside>
      </div>
    </CitizenPage>
  );
}
