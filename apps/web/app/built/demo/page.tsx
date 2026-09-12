import { BuildingFilm } from "@/components/BuildingFilm";
export const metadata = { title: "Recorded mock island", description: "Thirty days on a deterministic mock island. Watch recorded buildings grow. This demo uses no live model." };
export default async function DemoPage({ searchParams }: { searchParams: Promise<{place?: string; through?: string}> }) { const q = await searchParams; return <BuildingFilm key={`${q.place ?? "all"}:${q.through ?? "latest"}`} demo />; }
