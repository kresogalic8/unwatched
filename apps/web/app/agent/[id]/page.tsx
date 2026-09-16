"use client";
import { Inventory } from "@/components/citizen/Inventory";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, Label, Bubble, Tide } from "@/components/ui";
import {
  api,
  hhmm,
  dayOf,
  type OwnerAgent,
  type PublicAgent,
  type TownEvent,
} from "@/lib/api";
import { CitizenPage as Page } from "@/components/citizen/CitizenPage";
import { LinkButton, Button } from "@/components/explore/ExplorePage";
import s from "@/components/citizen/citizen.module.css";
import Link from "next/link";
import { Portrait } from "@/components/Portrait";

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const [a, setA] = useState<OwnerAgent | PublicAgent | null>(null);
  const [evs, setEvs] = useState<TownEvent[]>([]);
  const [error, setError] = useState("");
  const [eventsError, setEventsError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setA(null);
    setEvs([]);
    setError("");
    setEventsError(false);
    void api<OwnerAgent | PublicAgent>(`/api/agents/${id}`)
      .then((value) => {
        if (active) setA(value);
      })
      .catch(() => {
        if (active) setError("We couldn’t find this citizen right now.");
      });
    void api<TownEvent[]>(`/api/agents/${id}/events?since=0`)
      .then((value) => {
        if (active) setEvs(value.filter((e) => e.importance >= 0.3).reverse());
      })
      .catch(() => {
        if (active) setEventsError(true);
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);
  if (!a)
    return (
      <Page>
        <div className={s.empty} role={error ? "alert" : "status"}>
          {error || "Looking for them…"}
        </div>
        {error && (
          <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
        )}
      </Page>
    );
  const own = "coins" in a;
  const first = a.name.split(" ")[0];
  return (
    <Page signedIn={own}>
      <nav className={s.breadcrumb} aria-label="Breadcrumb">
        <Link href="/town">The island</Link>
        <span>/</span>
        <span>{a.name}</span>
      </nav>
      <section className={s.hero}>
        <Portrait
          name={a.name}
          appearance={a.appearance}
          age={a.age}
          size={180}
          locked={a.perks === false}
        />
        <div>
          <Label>{own ? "Your citizen" : "A citizen of the island"}</Label>
          <h1>{a.name}</h1>
          <p className={s.meta}>
            {a.age} years old · arrived day {a.arrivedDay} · from {a.origin}
          </p>
          <div className={s.actions}>
            {own && <LinkButton href="/letters">Write to {first}</LinkButton>}
            {own && (
              <LinkButton href={`/agent/${a.id}/book`} kind="secondary">
                Read the life book
              </LinkButton>
            )}
            <LinkButton href="/town" kind={own ? "secondary" : "primary"}>
              Watch the town
            </LinkButton>
          </div>
        </div>
        <div className={s.status}>
          <Label>On the island</Label>
          <p>{a.asleep ? "Asleep" : `At ${a.place}`}</p>
          <p className={s.meta}>
            {a.job ? `Working as ${a.job}` : "No recorded job"}
          </p>
        </div>
      </section>
      {"belongings" in a && a.belongings && <Inventory data={a.belongings}/>}
      <div className={s.profileGrid}>
        <section>
          <div className={s.sectionHead}>
            <h2>{own ? "A life in motion" : "What the town knows"}</h2>
            <span>{evs.length} recorded moments</span>
          </div>
          <div className={s.timeline}>
            {evs.slice(0, 60).map((e) => (
              <article key={e.id} className={s.event}>
                <time>
                  Day {dayOf(e.t)}
                  <span>{hhmm(e.t)}</span>
                </time>
                <div>
                  {e.text.length > 280 ? (
                    <>
                      <p>{e.text.slice(0, 278)}…</p>
                      <details>
                        <summary>Read full moment</summary>
                        <p>{e.text}</p>
                      </details>
                    </>
                  ) : (
                    <p>{e.text}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
          {eventsError && (
            <div role="alert">
              <p className={s.empty}>The timeline couldn’t be loaded.</p>
              <Button kind="secondary" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </Button>
            </div>
          )}
          {!eventsError && !evs.length && (
            <p className={s.empty}>
              Their story is just beginning. Recorded moments will appear here.
            </p>
          )}
          {evs.length > 60 && (
            <p className={s.note}>
              Showing the latest 60 moments.
              {own && (
                <>
                  {" "}
                  Find earlier days in{" "}
                  <Link href={`/agent/${a.id}/book`}>the life book</Link>.
                </>
              )}
            </p>
          )}
        </section>
        <aside className={s.sidebar} aria-label={`About ${first}`}>
          {own ? (
            <Card className={s.private}>
              <Label>Only you can see this</Label>
              <p>
                <b>The secret</b> · {String((a as OwnerAgent).persona.secret)}
              </p>
              <p className={s.meta}>
                Still a secret, as far as the record shows.
              </p>
            </Card>
          ) : (
            <Card>
              <Label>The public record</Label>
              <p className={s.meta}>
                You are seeing what the town knows. The owner sees the rest.
              </p>
            </Card>
          )}
          <Card>
            <Label>Knowledge passed on</Label>
            <p className="text-sm text-ink2">
              Advice heard from neighbors. These are shared experiences, not
              guarantees.
            </p>
            {(a.sharedKnowledge ?? [])
              .slice(-4)
              .reverse()
              .map((k) => (
                <div
                  key={k.eventId}
                  className="border-t border-ink/10 pt-3 text-sm"
                >
                  <p>
                    <a
                      className="text-teal underline"
                      href={`/agent/${k.from}`}
                    >
                      {k.name}
                    </a>{" "}
                    → {first}
                  </p>
                  <p>
                    {k.item} at {k.place}:{" "}
                    {k.confidence >= 0.5
                      ? "recent attempts mostly worked"
                      : "recent attempts were unreliable"}
                    .
                  </p>
                  <p className="text-xs text-drift">
                    Experience from day {dayOf(k.sourceT)} · shared day{" "}
                    {dayOf(k.sharedT)} · record #{k.eventId}
                  </p>
                  {own &&
                    (() => {
                      const test = (a as OwnerAgent).foodAdvice?.find(
                        (x) => x.eventId === k.eventId,
                      )?.tested;
                      return (
                        <p className="mt-1 text-teal">
                          {test
                            ? `Checked on day ${dayOf(test.t)}: ${
                                test.matched
                                  ? "this attempt agreed"
                                  : "this attempt disagreed"
                              }.`
                            : "Not checked firsthand yet."}
                        </p>
                      );
                    })()}
                </div>
              ))}
            {!a.sharedKnowledge?.length && (
              <p className="text-sm text-drift">
                No practical advice has been shared with them yet.
              </p>
            )}
          </Card>
          <Card>
            <Label>Observed routines</Label>
            <p className="text-sm text-ink2">
              Purchases recorded by the town, not inferred thoughts.
            </p>
            {(a.observedPurchases ?? []).slice(-4).map((r) => (
              <div
                key={`${r.place}:${r.item}`}
                className="border-t border-ink/10 pt-3 text-sm"
              >
                <b>
                  {r.item} · {r.place}
                </b>
                <p>
                  {r.receipts.length} recent successful{" "}
                  {r.receipts.length === 1 ? "purchase" : "purchases"}.
                </p>
                <details>
                  <summary className="cursor-pointer text-teal">
                    Show evidence
                  </summary>
                  {r.receipts.slice(-5).map((e) => (
                    <p key={e.eventId}>
                      Day {dayOf(e.t)}, {hhmm(e.t)} · {e.cost} coins · record #
                      {e.eventId}
                    </p>
                  ))}
                </details>
              </div>
            ))}
            {!a.observedPurchases?.length && (
              <p className="text-sm text-drift">
                No purchase evidence recorded yet.
              </p>
            )}
          </Card>
          {own && (
            <Card>
              <Label>Learning from experience</Label>
              <p className="text-sm text-ink2">
                When food shops are equally near, recent purchase outcomes help
                choose between them. Availability and affordability still come
                first. Old experiences lose influence.
              </p>
              {((a as OwnerAgent).foodRoutineDecisions ?? [])
                .slice(-3)
                .map((d, i) => (
                  <p
                    key={`${d.t}:${i}`}
                    className="text-sm border-l-2 border-teal pl-3"
                  >
                    Day {dayOf(d.t)} · From {d.from}, took the road to {d.next}{" "}
                    toward {d.preferred}. Without learning, the food routine
                    would have chosen {d.baseline}.
                  </p>
                ))}
              {((a as OwnerAgent).foodLessons ?? []).slice(-4).map((l) => (
                <div key={`${l.place}:${l.item}`} className="text-sm">
                  <b>
                    {l.item} · {l.place}
                  </b>
                  <p>
                    {l.evidence.filter((e) => e.success).length} successful,{" "}
                    {l.evidence.filter((e) => !e.success).length} unavailable
                    observations in retained evidence.
                  </p>
                </div>
              ))}
            </Card>
          )}

          {own ? (
            <>
              <Card>
                <Label>Money</Label>
                <div className="display text-[26px] font-semibold tabular">
                  {(a as OwnerAgent).coins}{" "}
                  <span className="text-sm text-drift font-normal">coins</span>
                </div>
                <div className="text-sm text-ink2">
                  {a.job ? `Works as ${a.job}.` : "No work."}{" "}
                  {a.home
                    ? `Sleeps at the ${a.home}, ${
                        (a as OwnerAgent).nightsPaid
                      } nights paid.`
                    : "No roof."}
                </div>
              </Card>
              <Card>
                <Label>People</Label>
                {(a as OwnerAgent).people.slice(0, 6).map((p) => (
                  <Tide
                    key={p.id}
                    name={p.name}
                    trust={p.trust}
                    word={p.tide}
                  />
                ))}
              </Card>
              <Card tone="glass">
                <Label tone="teal">What {first} keeps coming back to</Label>
                {(a as OwnerAgent).memories
                  .filter((m) => m.kind === "reflect")
                  .slice(0, 2)
                  .map((m, k) => (
                    <Bubble key={k} max={320}>
                      “{m.text}”
                    </Bubble>
                  ))}
                {(a as OwnerAgent).memories.filter((m) => m.kind === "reflect")
                  .length === 0 && (
                  <p className="text-sm text-ink2">
                    The first reflection is written after midnight.
                  </p>
                )}
              </Card>
            </>
          ) : (
            <>
              <Card>
                <Label>Known about {first}</Label>
                <div className="text-sm">
                  Job: {a.job ?? "none that anyone knows of"}
                </div>
                <div className="text-sm">
                  Lives at: {a.home ?? "nobody knows"}
                </div>
                <div className="text-sm">Money: nobody knows</div>
              </Card>
              <Card>
                <Label>Unknown</Label>
                <p className="text-sm text-ink2">
                  Where they really came from, what they are saving for, what
                  they fear. Someone would have to ask, and they would have to
                  answer.
                </p>
              </Card>
            </>
          )}
        </aside>
      </div>
    </Page>
  );
}
