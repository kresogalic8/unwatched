import { describe, expect, it } from "vitest";
import type { TownEvent } from "@unwatched/protocol";
import type { AgentState } from "@unwatched/engine";
import { tiesOf } from "../src/views.ts";

let n = 0;
const ev = (t: number, kind: string, actors: string[], payload?: Record<string, unknown>, text = "said"): TownEvent => ({ id: ++n, t, day: 1, kind, actors, text, importance: 0.5, ...(payload ? { payload } : {}) });
const here = new Map(["ana", "ivo", "mara"].map((id) => [id, { id } as AgentState]));

describe("the ties the public record shows", () => {
  const events = [
    ev(100, "conversation", ["ana", "ivo"]), ev(200, "agent.say", ["ivo", "ana"]), ev(300, "agent.give", ["ana", "ivo"]),
    ev(400, "agent.take", ["mara", "ivo"]), ev(500, "town.verdict", ["ivo", "mara"]),
    ev(600, "town.gathering", ["ana", "ivo"], { kind: "wedding" }), ev(650, "town.gathering", ["ana", "mara"], { kind: "wedding", held: false }),
    ev(700, "relation.change", ["ana", "mara"]), ev(710, "conversation", ["ana", "gone"]), ev(-99999, "conversation", ["ana", "mara"]),
  ];
  const ties = tiesOf({ t: 1000, events, agents: here } as never, 7);
  const between = (x: string, y: string) => ties.find((t) => (t.a === x && t.b === y) || (t.a === y && t.b === x));

  it("counts talk, gifts and a wedding between two people, whichever of them began it", () => {
    expect(between("ana", "ivo")).toMatchObject({ talk: 2, give: 1, wed: true, last: 600 });
  });
  it("marks a theft and a charge before the council", () => {
    expect(between("ivo", "mara")).toMatchObject({ take: 1, accuse: 1, talk: 0 });
  });
  it("leaves out what is private, what did not happen, who is gone, and what is too old", () => {
    expect(between("ana", "mara")).toBeUndefined();
    expect(ties.some((t) => t.a === "gone" || t.b === "gone")).toBe(false);
  });
});
