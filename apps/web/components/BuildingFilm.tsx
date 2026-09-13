"use client";
import { CommunityProjects } from "./CommunityProjects";
import { gardenArt } from "./world/garden-art";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { constructionStage, type BuildingReplay } from "@unwatched/protocol";
import { API } from "@/lib/api";
import { ExplorePage, Button } from "./explore/ExplorePage";
import s from "./explore/explore.module.css";
import { House as HarborHouse, P } from "./world/harbor-art";

/** Architectural reconstruction from measured labor; no invented citizen movements or dialogue. */
function House({
  labor,
  needed,
  shop = false,
  garden = false,
}: {
  labor: number;
  needed: number;
  shop?: boolean;
  garden?: boolean;
}) {
  const id = useId(),
    ratio = Math.max(0, Math.min(1, labor / Math.max(1, needed))),
    finished = ratio >= 1;
  const [x, y] = P(130, 95),
    height =
      ratio < 0.3
        ? 8
        : ratio < 0.8
          ? 28 + (ratio - 0.3) * 270
          : 170 + (ratio - 0.8) * 450;
  if (garden)
    return (
      <image
        x="-165"
        y="-135"
        width="330"
        height="232.5"
        href={`data:image/svg+xml,${encodeURIComponent(gardenArt(ratio))}`}
      />
    );
  return (
    <g>
      <path
        d="M-128 -4L-40 -46L108 2L18 45Z"
        fill="#ddd7bd"
        stroke="#b5b69d"
        strokeWidth="1"
      />
      <defs>
        <clipPath id={id}>
          <rect x="-200" y={-height} width="400" height={height + 5} />
        </clipPath>
      </defs>
      <g clipPath={finished ? undefined : `url(#${id})`}>
        <g transform={`translate(${-x * 0.9} ${-y * 0.9}) scale(.9)`}>
          <HarborHouse u={0} v={0} w={130} d={95} h={142} name="" cafe={shop} />
        </g>
      </g>
      {!finished && (
        <g stroke="#a28d69" strokeWidth="2" fill="none">
          <path d="M-110 4V-181M105 4V-181M-110 -65H105M-110 -148H105M-110 -65L-62 -148M105 -65L61 -148" />
          <path d="M119 8L147 -138M132 8L160 -138" />
          {Array.from({ length: 10 }, (_, i) => (
            <path key={i} d={`M${120 + i * 2.8} ${3 - i * 14}h13`} />
          ))}
        </g>
      )}
    </g>
  );
}

export function BuildingFilm({
  place,
  demo = false,
}: {
  place?: string;
  demo?: boolean;
}) {
  const [data, setData] = useState<BuildingReplay | null>(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [overview, setOverview] = useState(false);
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const art = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    setIndex(0);
    setPlaying(false);
    const through = new URLSearchParams(location.search).get("through");
    const query =
      place && through ? `?through=${encodeURIComponent(through)}` : "";
    fetch(
      demo
        ? "/demo/construction.json"
        : `${API}/api/construction${place ? `/${encodeURIComponent(place)}` : ""}${query}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok || !body)
          throw new Error(
            body?.error ??
              "The construction record is unavailable on this island. Try again, or open the recorded mock demo.",
          );
        return body as BuildingReplay;
      })
      .then((body) => {
        if (demo) {
          const q = new URLSearchParams(location.search);
          const chosen = q.get("place");
          const end = q.get("through");
          if (chosen)
            body.buildings = body.buildings.filter(
              (b) => b.history.place === chosen,
            );
          if (end)
            body.buildings = body.buildings.map((b) => ({
              ...b,
              history: {
                ...b.history,
                moments: b.history.moments.filter(
                  (m) => m.sequence <= Number(end),
                ),
              },
            }));
        }
        setData(body);
        if (through)
          setIndex(
            Math.max(
              0,
              body.buildings.reduce((n, b) => n + b.history.moments.length, 0) -
                1,
            ),
          );
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [place, demo, attempt]);
  const frames = (
    data?.buildings.flatMap((b) => b.history.moments.map((m) => ({ b, m }))) ??
    []
  ).sort(
    (a, b) =>
      a.m.t - b.m.t ||
      a.b.history.place.localeCompare(b.b.history.place) ||
      a.m.sequence - b.m.sequence,
  );
  const frame = frames[index];
  const count = frames.length;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setIndex((i) => {
          if (i >= count - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        }),
      Math.max(500, Math.min(5000, 60000 / Math.max(1, count))),
    );
    return () => clearInterval(timer);
  }, [playing, count]);
  const h = frame?.b.history;
  const m = frame?.m;
  const share = async () => {
    if (!h || !m) return;
    const url = demo
      ? `${location.origin}/built/demo?place=${encodeURIComponent(h.place)}&through=${m.sequence}`
      : `${location.origin}/built/${encodeURIComponent(h.place)}?through=${m.sequence}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Link copied. It opens this recorded chapter.");
    } catch {
      setNotice(`Copy this link: ${url}`);
    }
  };
  const savePicture = () => {
    if (!art.current || !h) return;
    const blob = new Blob(
      [new XMLSerializer().serializeToString(art.current)],
      { type: "image/svg+xml" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unwatched-${h.place}-${m?.sequence}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <ExplorePage
      eyebrow={`${demo ? "Recorded mock demo · 30 days" : "The building record"} · ${data?.town ?? "Unwatched"}`}
      title="They left a mark."
      description="An intention. Someone else's help. A place that wasn't here before. Follow the work that turns an idea into part of the island."
      art="/harbor/cottage.png"
    >
      {!place && !demo && (
        <>
          <CommunityProjects embedded />
          <Link
            href="/built/garden-demo"
            className="inline-block my-5 text-teal underline"
          >
            Explore a recorded garden scenario →
          </Link>
        </>
      )}
      {error && (
        <div role="alert" className="py-12 max-w-xl">
          <p>{error}</p>
          <button
            className="mt-4 underline text-teal"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </button>
          <Link className="ml-5 underline" href="/built">
            All buildings
          </Link>
          <Link className="ml-5 underline" href="/built/demo">
            Try the recorded mock demo
          </Link>
        </div>
      )}
      {!data && !error && (
        <div role="status" className="bg-glass rounded p-16 text-ink2">
          Opening the building record…
        </div>
      )}
      {data && !frame && (
        <section className="rounded bg-glass py-20 px-8 max-w-3xl">
          <h2 className="display text-3xl">
            The first foundation is still ahead.
          </h2>
          <p className="mt-4 text-ink2">
            New buildings will leave their history here as citizens start them.
            Older buildings have no recorded construction replay.
          </p>
          <Link href="/town" className="inline-block mt-6 text-teal underline">
            Spend a minute on the island →
          </Link>
          <Link
            href="/built/demo"
            className="inline-block ml-5 mt-6 text-teal underline"
          >
            Try the recorded mock demo →
          </Link>
        </section>
      )}
      {data && frame && h && m && (
        <>
          <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-7">
            <section className="min-w-0">
              <svg
                ref={art}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 880 560"
                role="img"
                aria-label={`${h.name}, day ${m.day}: ${constructionStage(m.labor, h.needed)}, ${m.labor} of ${h.needed} mornings worked`}
                className={s.replay}
                style={{ background: "#eee7d8" }}
              >
                <rect width="880" height="560" fill="#eee7d8" rx="24" />
                <path
                  d="M0 370Q210 314 460 393T880 366V560H0Z"
                  fill="#cbd8cc"
                />
                <path
                  d="M0 416Q220 355 460 429T880 404V560H0Z"
                  fill="#afc9bd"
                />
                <g stroke="#f5f1e5" opacity=".55" fill="none">
                  {[0, 1, 2, 3].map((i) => (
                    <path
                      key={i}
                      d={`M20 ${456 + i * 18}Q250 ${414 + i * 18} 480 ${457 + i * 18}T850 ${450 + i * 18}`}
                    />
                  ))}
                </g>
                <text
                  x="36"
                  y="48"
                  fontFamily="Georgia,serif"
                  fontSize="23"
                  fill="#274c48"
                >
                  UNWATCHED
                </text>
                <text
                  x="844"
                  y="46"
                  textAnchor="end"
                  fontFamily="sans-serif"
                  fontSize="13"
                  fill="#274c48"
                >
                  DAY {m.day} ·{" "}
                  {constructionStage(m.labor, h.needed).toUpperCase()}
                </text>
                {overview ? (
                  <g>
                    {data.buildings.map((b) => {
                      const at = b.history.moments
                        .filter((x) => x.t <= m.t)
                        .at(-1);
                      const x = 100 + (b.x / data.size.w) * 660;
                      const y = 125 + (b.y / data.size.h) * 260;
                      return (
                        <g
                          key={b.history.place}
                          transform={`translate(${x} ${y})`}
                          opacity={at ? 1 : 0.22}
                        >
                          {at ? (
                            <g transform="scale(.29)">
                              <House
                                labor={at.labor}
                                needed={b.history.needed}
                                shop={b.history.what === "shop"}
                                garden={b.history.what === "garden"}
                              />
                            </g>
                          ) : (
                            <path
                              d="M-25 0H25M0 -10V10"
                              stroke="#274c48"
                              strokeDasharray="3 3"
                            />
                          )}
                          <text
                            x="0"
                            y="28"
                            textAnchor="middle"
                            fontFamily="sans-serif"
                            fontSize="11"
                            fill="#274c48"
                          >
                            {at ? b.history.name : "Unbuilt plot"}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                ) : (
                  <g transform="translate(438 347) scale(1.18)">
                    <House
                      labor={m.labor}
                      needed={h.needed}
                      shop={h.what === "shop"}
                      garden={h.what === "garden"}
                    />
                  </g>
                )}
                <text
                  x="36"
                  y="495"
                  fontFamily="Georgia,serif"
                  fontSize="27"
                  fill="#274c48"
                >
                  {h.name.length > 48 ? h.name.slice(0, 45) + "…" : h.name}
                </text>
                <text
                  x="36"
                  y="523"
                  fontFamily="sans-serif"
                  fontSize="13"
                  fill="#274c48"
                >
                  {m.labor} / {h.needed} mornings worked ·{" "}
                  {m.people
                    .map((p) => p.name)
                    .join(", ")
                    .slice(0, 82)}
                </text>
                <text
                  x="844"
                  y="546"
                  textAnchor="end"
                  fontFamily="sans-serif"
                  fontSize="10"
                  fill="#46665d"
                >
                  RECONSTRUCTION FROM RECORDED ACTIONS · unwatched.world
                </text>
              </svg>
              <div className="flex gap-4 items-center mt-4">
                <Button
                  className="min-w-28"
                  aria-label={playing ? "Pause replay" : "Play replay"}
                  onClick={() => {
                    if (index === count - 1) setIndex(0);
                    setPlaying(!playing);
                  }}
                >
                  {playing ? "Pause" : index === count - 1 ? "Replay" : "Play"}
                </Button>
                <input
                  className={s.range}
                  type="range"
                  min="0"
                  max={count - 1}
                  value={index}
                  aria-label="Recorded moment"
                  onChange={(e) => {
                    setPlaying(false);
                    setIndex(Number(e.target.value));
                  }}
                />
                <span className="text-xs tabular text-drift whitespace-nowrap">
                  {index + 1} / {count}
                </span>
              </div>
              <div className="flex gap-4 mt-4 text-sm text-teal">
                <button
                  aria-pressed={!overview}
                  onClick={() => setOverview(false)}
                  className="underline underline-offset-4"
                >
                  This building
                </button>
                <button
                  aria-pressed={overview}
                  onClick={() => setOverview(true)}
                  className="underline underline-offset-4"
                >
                  Island growth
                </button>
              </div>
              <p className="mt-3 text-xs text-drift">
                {data.source}. Time between recorded moments is compressed.
                Drawings reconstruct labor stages; they are not historical
                footage. The overview shows recorded building plots on the
                current map layout.
              </p>
            </section>
            <aside className="flex flex-col gap-5 py-2 min-w-0">
              <div>
                <p className="text-sm text-drift">
                  {frame.b.district} · {h.what}
                </p>
                <h2 className="display text-3xl mt-2">{h.project}</h2>
                <p className="mt-2 text-ink2">
                  Started by {h.builder.name}, day{" "}
                  {Math.floor(h.started / 1440) + 1}.
                </p>
              </div>
              <div className="border-y border-drift/20 py-5">
                <p className="text-xs uppercase tracking-widest text-teal">
                  Day {m.day} · {m.kind}
                </p>
                <p className="mt-3 text-xl leading-snug">{m.text}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
                  {m.people.map((p) =>
                    demo ? (
                      <span key={p.id} className="text-sm text-teal">
                        {p.name}
                      </span>
                    ) : (
                      <Link
                        key={p.id}
                        className="text-sm text-teal underline underline-offset-4"
                        href={`/agent/${p.id}`}
                      >
                        {p.name}
                      </Link>
                    ),
                  )}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-drift">Land</dt>
                  <dd>{h.landCoins} coins</dd>
                </div>
                <div>
                  <dt className="text-drift">Materials</dt>
                  <dd>
                    {h.planks} planks · {h.materialCoins} coins
                  </dd>
                </div>
                <div>
                  <dt className="text-drift">Work recorded</dt>
                  <dd>
                    {m.labor} / {h.needed} mornings
                  </dd>
                </div>
                <div>
                  <dt className="text-drift">Help paid so far</dt>
                  <dd>
                    {h.moments
                      .filter(
                        (x) => x.sequence <= m.sequence && x.kind === "paid",
                      )
                      .reduce((n, x) => n + (x.coins ?? 0), 0)}{" "}
                    coins
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-4 text-sm font-semibold text-teal">
                <button
                  onClick={() => void share()}
                  className="underline underline-offset-4"
                >
                  Share this chapter ↗
                </button>
                <button
                  onClick={savePicture}
                  className="underline underline-offset-4"
                >
                  Save picture ↓
                </button>
              </div>
              <p role="status" className="text-xs text-ink2 break-words">
                {notice}
              </p>
              {(place || demo) && (
                <Link
                  href={demo ? "/built/demo" : "/built"}
                  className="text-sm text-teal"
                >
                  ← Watch every building
                </Link>
              )}
            </aside>
          </div>
          <section className="mt-12 mb-12">
            <h2 className="display text-2xl mb-5">The marks on the island</h2>
            <div className="flex flex-wrap gap-3">
              {data.buildings.map((b) => {
                const latest = b.history.moments.at(-1);
                return (
                  <Link
                    key={b.history.place}
                    href={
                      demo
                        ? `/built/demo?place=${encodeURIComponent(b.history.place)}&through=${latest?.sequence ?? 1}`
                        : `/built/${encodeURIComponent(b.history.place)}?through=${latest?.sequence ?? 1}`
                    }
                    className="border border-line rounded px-5 py-4 hover:bg-sand transition-colors"
                  >
                    <span className="block font-semibold">
                      {b.history.name}
                    </span>
                    <span className="text-sm text-drift">
                      {b.history.builder.name} ·{" "}
                      {constructionStage(latest?.labor ?? 0, b.history.needed)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </ExplorePage>
  );
}
