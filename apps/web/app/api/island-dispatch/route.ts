import { NextResponse } from "next/server";

import { dispatchItems } from "@/lib/island-dispatch";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const [townResponse, eventResponse] = await Promise.all([
      fetch(`${base}/api/town`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) }),
      fetch(`${base}/api/events`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) }),
    ]);
    if (!townResponse.ok || !eventResponse.ok) throw new Error("Island unavailable");
    const town = await townResponse.json();
    const events = await eventResponse.json();
    if (!Array.isArray(events) || !Number.isFinite(town.day) || !Number.isFinite(town.population)) throw new Error("Invalid island record");
    const items = dispatchItems(events);
    return NextResponse.json({ day: town.day, population: town.population, items }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  } catch {
    return NextResponse.json({ error: "The island record is unavailable right now." }, { status: 503 });
  }
}
