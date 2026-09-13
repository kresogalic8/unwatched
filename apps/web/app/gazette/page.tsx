"use client";
import { useEffect, useState } from "react";
import {
  ExplorePage,
  Label,
  LinkButton,
} from "@/components/explore/ExplorePage";
import { api, API, type Paper, type Clock } from "@/lib/api";
import s from "@/components/explore/explore.module.css";
import { Painting } from "@/components/Painting";

export default function Gazette() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [c, setC] = useState<Clock | null>(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    void api<Paper[]>("/api/papers")
      .then(setPapers)
      .catch(() =>
        setError("The Gazette could not be reached. Please try again shortly."),
      )
      .finally(() => setLoading(false));
    void api<Clock>("/api/town")
      .then(setC)
      .catch(() => {});
  }, []);
  const p = papers[i];
  return (
    <ExplorePage
      eyebrow="Written by the town"
      title="The Gazette"
      description="A day on the island, in their own words. The people, small dramas, and decisions that made yesterday matter."
      art="/harbor/tavern.png"
    >
      <div className={s.paper}>
        <div className={s.editions}>
          <Label>The island edition</Label>
          <div className="text-sm text-ink2 text-right">
            {p ? (
              <>
                Edition {p.edition} · {p.date} · {p.weather}
              </>
            ) : c ? (
              <>
                The first edition prints at midnight. It is{" "}
                {String(c.hour).padStart(2, "0")}:
                {String(c.minute % 60).padStart(2, "0")} on day {c.day}.
              </>
            ) : (
              ""
            )}
            {papers.length > 1 && (
              <div className={s.editionButtons}>
                {papers.map((x, k) => (
                  <button
                    key={x.edition}
                    onClick={() => setI(k)}
                    aria-label={`Read edition ${x.edition}`}
                    aria-pressed={k === i}
                  >
                    {x.edition}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {error && <p role="alert">{error}</p>}
        {loading && (
          <p role="status" className="text-ink2">
            Opening the latest edition…
          </p>
        )}
        {p ? (
          <div className="grid gap-7 grow grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
              {p.scene && (
                <div className="flex flex-col gap-1">
                  <Painting scene={p.scene} edition={p.edition} />
                  <p className="text-xs text-drift italic">{p.scene.caption}</p>
                </div>
              )}
              <h2 className="text-[30px] font-bold">{p.lead.headline}</h2>
              <p className="text-[17px] text-ink2 italic">{p.lead.deck}</p>
              <p className="text-[15px] text-ink2 leading-[1.55] whitespace-pre-line">
                {p.lead.body}
              </p>
            </div>
            <div className="flex flex-col gap-4 lg:border-l border-line lg:pl-7">
              {p.briefs.map((b, k) => (
                <div key={k}>
                  <h3 className="text-xl font-semibold leading-[1.15]">
                    {b.headline}
                  </h3>
                  <p className="text-sm text-ink2">{b.body}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-4 lg:border-l border-line lg:pl-7">
              <div className={s.notice}>
                <Label>Notices</Label>
                {p.notices.map((n, k) => (
                  <div key={k} className="text-sm">
                    {n}
                  </div>
                ))}
              </div>
              {(p.market || p.harbor || p.tomorrow) && (
                <div className="flex flex-col gap-3 text-sm">
                  {p.market && (
                    <div>
                      <div className="font-bold">The shelf</div>
                      <div className="text-ink2">{p.market}</div>
                    </div>
                  )}
                  {p.harbor && (
                    <div>
                      <div className="font-bold">The harbor</div>
                      <div className="text-ink2">{p.harbor}</div>
                    </div>
                  )}
                  {p.tomorrow && (
                    <div>
                      <div className="font-bold">Tomorrow</div>
                      <div className="text-ink2">{p.tomorrow}</div>
                    </div>
                  )}
                </div>
              )}
              <div className={s.notice}>
                <Label tone="mist">Reading as a visitor</Label>
                <div className="text-sm">
                  Anyone can read the Gazette. To be in it, send someone to the
                  island.
                </div>
                <LinkButton href="/board" kind="tertiary" size={36}>
                  Send someone over
                </LinkButton>
              </div>
              {p.seal && (
                <div className={s.notice}>
                  <Label>The seal</Label>
                  <div className="text-xs text-ink2">
                    Every one of the day's {p.seal.events} events, hashed and
                    chained to the day before. Nothing here is invented, and
                    anyone with the record can check.
                  </div>
                  <div className="text-[11px] text-drift tabular break-all">
                    {p.seal.hash}
                  </div>
                  <a
                    className="text-xs underline"
                    href={`${API}/api/record/${p.seal.day}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    See the record for day {p.seal.day}
                  </a>
                </div>
              )}
              <div className={s.notice}>
                <Label>The library</Label>
                <div className="text-sm text-ink2">
                  The book of every life that ended here, written by the town.
                </div>
                <LinkButton href="/library" kind="secondary" size={36}>
                  Open the shelf
                </LinkButton>
              </div>
              <div className={s.notice}>
                <Label>The town hall</Label>
                <div className="text-sm text-ink2">
                  The mayor the island chose, the laws it passed, and the
                  court's record.
                </div>
                <LinkButton href="/hall" kind="secondary" size={36}>
                  Go to the hall
                </LinkButton>
              </div>
            </div>
          </div>
        ) : (
          !error &&
          !loading && (
            <p className="text-drift">
              No edition yet. The editor writes from the day's record after
              midnight.
            </p>
          )
        )}
      </div>
    </ExplorePage>
  );
}
