"use client";
import { useMemo, useState } from "react";
import { Interior, type InteriorPerson } from "@/components/Interior";

/** The place each room stands for, as the town names it. */
const ROOMS: { label: string; kind: string; sprite: string }[] = [
  { label: "Konoba", kind: "tavern", sprite: "tavern" },
  { label: "Home", kind: "home", sprite: "house" },
  { label: "Inn", kind: "inn", sprite: "inn" },
  { label: "Bakery", kind: "shop", sprite: "bakery" },
  { label: "Smithy", kind: "shop", sprite: "smithy" },
  { label: "Mill", kind: "shop", sprite: "mill" },
  { label: "Fish house", kind: "shop", sprite: "fishhouse" },
  { label: "Loggia", kind: "civic", sprite: "council" },
  { label: "Shop", kind: "shop", sprite: "shop" },
  { label: "Chandlery", kind: "harbor", sprite: "chandlery" },
];

const PEOPLE: InteriorPerson[] = [
  { id: "a", name: "Mara", asleep: false, job: "baker", appearance: null, age: 34, pose: "work" },
  { id: "b", name: "Ivo", asleep: false, job: "fisher", appearance: null, age: 52, pose: "sit" },
  { id: "c", name: "Ante", asleep: false, job: null, appearance: null, age: 21, pose: "idle" },
  { id: "d", name: "Zora", asleep: true, job: null, appearance: null, age: 67, pose: "sleep" },
];

export function Rooms() {
  const [room, setRoom] = useState(0), [night, setNight] = useState(false), [crowd, setCrowd] = useState(true);
  const people = useMemo(() => (crowd ? PEOPLE : []), [crowd]);
  const stock = useMemo(() => ({ fish: 6 }), []);
  const r = ROOMS[room]!;
  return <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
    <h1 style={{ fontSize: 36, margin: "0 0 12px" }}>Interiors</h1>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
      {ROOMS.map((x, i) => <button type="button" key={x.label} onClick={() => setRoom(i)} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #4f6257", background: i === room ? "#4f6257" : "transparent", color: i === room ? "#fff" : "inherit" }}>{x.label}</button>)}
      <button type="button" onClick={() => setNight(!night)} style={{ padding: "4px 10px" }}>{night ? "Night" : "Day"}</button>
      <button type="button" onClick={() => setCrowd(!crowd)} style={{ padding: "4px 10px" }}>{crowd ? "With people" : "Empty"}</button>
    </div>
    <Interior kind={r.kind} sprite={r.sprite} hour={night ? 23 : 11} people={people} stock={stock} />
  </main>;
}
