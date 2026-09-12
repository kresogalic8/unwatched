import type { Metadata } from "next";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
type Moment = { moment: { id: number; day: number; t: number; text: string; payload?: { lines?: { speaker: string; text: string }[] } }; place: string | null; people: { id: string; name: string }[] };
const hhmm = (t: number) => { const m = t % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };

/** A pasted link previews as the moment itself: the quote, and the scene it was said in. Only what was public on the street. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const fallback: Metadata = { title: "A moment on the island", description: "Something that happened on the street, for anyone to see.", robots: { index: false, follow: false } };
  try {
    const res = await fetch(`${API}/api/moments/${encodeURIComponent(id)}`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(3000) }); if (!res.ok) return fallback;
    const m = (await res.json()) as Moment;
    const quote = m.moment.payload?.lines?.[0]?.text; const first = m.moment.text.split(/[.!?]/)[0]!.replace(/[“”"]/g, "").trim();
    const title = (quote ? `“${quote}”` : first).slice(0, 90);
    const scene = `${m.people.map((p) => p.name).join(" and ")}${m.place ? ` at ${m.place}` : ""}, day ${m.moment.day} at ${hhmm(m.moment.t)}. ${quote ? first : "On the island, where everyone belongs to someone."}`.slice(0, 200);
    return { title, description: scene, robots: { index: false, follow: false }, openGraph: { title: `${title} · Unwatched`, description: scene, url: `/m/${id}`, type: "article" }, twitter: { card: "summary_large_image", title, description: scene } };
  } catch { return fallback; }
}
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
