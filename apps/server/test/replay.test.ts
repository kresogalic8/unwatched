import { describe, expect, it } from "vitest";
import type { TownEvent } from "@unwatched/protocol";
import type { AgentState } from "@unwatched/engine";
import { replayOf } from "../src/views.ts";

let n = 0;
const ev = (t: number, kind: string, actors: string[], place?: string, text = ""): TownEvent => ({ id: ++n, t, day: Math.floor(t / 1440) + 1, kind, actors, ...(place ? { place } : {}), text, importance: 0.5 });
const agent = (id: string, location: string, asleep = false) => [id, { id, location, asleep } as AgentState] as const;

describe("the day again", () => {
  const events = [
    ev(100, "weather.change", [], undefined, "The weather turned to fog."),
    ev(200, "agent.move", ["ana"], "inn"), ev(300, "agent.sleep", ["ana"], "inn"),
    ev(400, "agent.move", ["ivo"], "harbor"),
    ev(1500, "agent.wake", ["ana"], "inn"), ev(1510, "agent.move", ["ana"], "market"),
    ev(1600, "agent.arrive", ["new"], "harbor"), ev(1620, "agent.move", ["new"], "inn"),
    ev(1700, "agent.letter", ["ivo"], "harbor", "Dear mother, the fish are small."),
  ];
  const town = { t: 1440 + 400, weather: "clear", events, agents: new Map([agent("ana", "market"), agent("ivo", "square"), agent("new", "inn")]) };
  const r = replayOf(town as never, 24, (e) => e.kind === "agent.letter" ? { ...e, text: "" } : e);

  it("begins where everyone stood a day ago, asleep or awake, in the weather then", () => {
    expect(r.from).toBe(400);
    expect(r.weather).toBe("fog");
    expect(r.start.ana).toEqual({ location: "inn", asleep: true });
  });
  it("keeps whoever came on a boat since off the island until the boat brings them", () => {
    expect(r.start.new).toBeUndefined();
  });
  it("places whoever never walked since where they stand now", () => {
    expect(r.start.ivo).toEqual({ location: "square", asleep: false });
  });
  it("carries the day's moments as the public sees them, and a walk only as where it stopped", () => {
    expect(r.events.map((e) => e.kind)).toEqual(["agent.move", "agent.wake", "agent.move", "agent.arrive", "agent.move", "agent.letter"]);
    expect(r.events.find((e) => e.kind === "agent.letter")?.text).toBe("");
    expect(r.events.every((e) => e.kind !== "agent.move" || e.text === "")).toBe(true);
  });
});
