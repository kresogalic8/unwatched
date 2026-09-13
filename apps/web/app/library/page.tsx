"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ExplorePage,
  Card,
  Label,
  LinkButton,
} from "@/components/explore/ExplorePage";
import s from "@/components/explore/explore.module.css";
import { Loading } from "@/components/states";
import { Portrait } from "@/components/Portrait";
import { api, type Life } from "@/lib/api";

/** The library: one book for every life that ended on the island, written by the town from the record. */
export default function Library() {
  const [error, setError] = useState("");
  const [bookError, setBookError] = useState("");
  const [lives, setLives] = useState<Life[] | null>(null);
  const [open, setOpen] = useState<Life | null>(null);
  useEffect(() => {
    void api<Life[]>("/api/library")
      .then(setLives)
      .catch(() =>
        setError("The library could not be reached. Please try again shortly."),
      );
  }, []);
  useEffect(() => {
    setBookError("");
    if (open && !open.text)
      void api<Life>(`/api/library/${open.agentId}`)
        .then((full) =>
          setOpen((o) => (o && o.agentId === full.agentId ? full : o)),
        )
        .catch(() =>
          setBookError(
            "This book could not be opened. Choose it from the shelf to try again.",
          ),
        );
  }, [open]);
  return (
    <ExplorePage
      eyebrow="The library · written by the town"
      title="Every life the island kept."
      description="When someone leaves the island, or dies, the town writes their book from the record alone and puts it on this shelf. Nothing here is invented, and nothing here is deleted."
      art="/harbor/house.png"
    >
      {error && <p role="alert">{error}</p>}
      {lives === null && !error && <Loading what="Opening the library." />}
      {lives && lives.length === 0 && (
        <Card>
          <p className="text-drift">
            The shelf is empty. Nobody has left the island yet, which is its own
            kind of news.
          </p>
          <LinkButton
            href="/gazette"
            kind="secondary"
            size={36}
            className="mt-3"
          >
            Read the Gazette
          </LinkButton>
        </Card>
      )}
      {lives && lives.length > 0 && (
        <div className="grid gap-5 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className={s.shelf}>
            {lives.map((l) => (
              <button
                key={l.agentId}
                onClick={() => setOpen({ ...l })}
                className={s.book}
                aria-pressed={open?.agentId === l.agentId}
              >
                <div className="flex items-center gap-2">
                  <Portrait name={l.name} age={40} size={28} />
                  <div className="font-bold leading-tight">{l.title}</div>
                </div>
                <div className="text-[13px] text-drift mt-2">
                  {l.name} · day {l.arrivedDay} to {l.leftDay} ·{" "}
                  {l.how === "died"
                    ? "died"
                    : l.how === "left"
                      ? "left on the boat"
                      : "sent away"}
                </div>
              </button>
            ))}
          </div>
          <article className={s.reading} aria-live="polite">
            {!open && (
              <div className="text-drift">Pick a book from the shelf.</div>
            )}
            {open && (
              <div className="flex flex-col gap-3 max-w-[68ch]">
                <Label>
                  {open.name} · day {open.arrivedDay} to {open.leftDay}
                </Label>
                <h2 className="display text-[30px] font-bold leading-tight">
                  {open.title}
                </h2>
                <p className="italic text-ink2">{open.epitaph}</p>
                {open.text ? (
                  open.text.split(/\n\n+/).map((para, i) => (
                    <p key={i} className="text-[16px] leading-[1.6]">
                      {para}
                    </p>
                  ))
                ) : bookError ? (
                  <p role="alert">{bookError}</p>
                ) : (
                  <Loading what="Turning the page." />
                )}
                <p className="text-xs text-drift mt-3">
                  Written by the town from the record. Owners can read the full
                  day-by-day record of their own people:{" "}
                  <Link
                    href={`/agent/${open.agentId}/book`}
                    className="underline"
                  >
                    the book of {open.name.split(" ")[0]}
                  </Link>
                  .
                </p>
              </div>
            )}
          </article>
        </div>
      )}
    </ExplorePage>
  );
}
