import { describe, expect, it } from "vitest";
import { dispatchItems } from "./island-dispatch";

describe("landing public dispatch", () => {
  it("excludes private events and never forwards payloads or owner fields", () => {
    const items = dispatchItems([
      { id: 1, t: 100, kind: "agent.say", text: "Hello from the street", owner: "private-owner", payload: { because: "private thought" } },
      ...["agent.letter", "agent.reflect", "agent.plan", "agent.self", "relation.change", "town.book", "constructor"].map((kind, id) => ({ id: id + 2, t: 110, kind, text: "Private content" })),
    ]);
    expect(items).toEqual([{ id: 1, t: 100, text: "Hello from the street", label: "On the street" }]);
  });
  it("keeps three newest distinct moments and ignores malformed records", () => {
    expect(dispatchItems(null)).toEqual([]);
    const events = [1, 2, 3, 4].map(id => ({ id, t: id, kind: "agent.arrive", text: `Arrival ${id}` }));
    expect(dispatchItems([...events, { ...events[3], id: 5 }, null, {}, { kind: "agent.say", id: 6, t: "bad", text: "Invalid" }]).map(item => item.id)).toEqual([5, 3, 2]);
  });
});
