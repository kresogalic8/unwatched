import { describe, expect, it } from "vitest";
import { Town } from "../src/index.ts";
import type { Brain, TownSnapshot } from "../src/index.ts";
import { Action, Perception } from "@unwatched/protocol";

const mind: Brain = {
  name: "builder-test",
  async decide() { return { action: { kind: "wait" }, remember: [] }; },
  async reflect() { return { summary: "I say it is finished.", insights: [], opinions: [], intentions: [], letter_to_owner: null, projects: [{ title: "A home", progress: "Finished!", done: true }] }; },
  async plan() { return { mood: "working", goals: [], steps: [] }; },
  async converse() { throw new Error("no conversation"); },
  async digest() { return { text: "", headline: "" }; },
  async child() { throw new Error("no child"); },
  async writePaper() { throw new Error("no paper"); },
  async life() { return { title: "A life", text: "", epitaph: "" }; },
  async judge() { return { happened: "nothing", plausible: false, coins_spent: 0, item_gained: null, item_lost: null, eases: null, trust: [] }; },
};
const persona = (name: string) => ({ name, age: 30, origin: "mainland", summary: "A builder", want: "a home", fear: "rain", secret: "none", strangers: "polite", advice: "listens", traits: { warmth: 0.5, pride: 0.5, caution: 0.5, honesty: 0.5, ambition: 0.5 } });
function fixture() {
  const t = new Town({ seed: 7, brain: mind });
  const owner = t.addAgent({ persona: persona("Owner") });
  const helper = t.addAgent({ persona: persona("Helper") });
  t.t = 540; owner.location = helper.location = "shore-1";
  expect(t.apply(owner, Action.parse({ kind: "build", what: "house", at: "shore-1", project: "A home" }), "test")).toBe(true);
  return { t, owner, helper, site: t.places.get("shore-1")! };
}
function promise(f: ReturnType<typeof fixture>, mornings = 2) {
  expect(f.t.apply(f.helper, Action.parse({ kind: "offer", to: f.owner.id, what: "help build your home", coins: 4, days: 2, construction: { site: f.site.id, mornings } }), "test")).toBe(true);
  expect(f.t.apply(f.owner, { kind: "accept" }, "test")).toBe(true);
}

describe("construction projects and promises", () => {
  it("ties the chosen project to paid materials and real labor, including a helper's final morning", () => {
    const f = fixture(); promise(f, 3);
    expect(f.owner.projects[0]).toMatchObject({ title: "A home", done: false, construction: { labor: 0, needed: 6 } });
    expect(f.t.places.get("sawpit")!.stock.planks).toBe(18);
    expect(f.t.apply(f.helper, { kind: "settle" }, "test")).toBe(false);
    for (let day = 1; day <= 3; day++) {
      f.t.day = day; f.t.t = (day - 1) * 1440 + 540;
      expect(f.t.apply(f.owner, { kind: "work" }, "test")).toBe(true);
      expect(f.t.apply(f.helper, { kind: "work" }, "test")).toBe(true);
    }
    expect(f.site.site).toBeNull(); expect(f.site.kind).toBe("home");
    expect(f.owner.projects[0]).toMatchObject({ done: true, doneDay: 3, construction: { labor: 6, needed: 6 } });
    expect(f.helper.deals[0]!.construction!.done).toBe(3);
    const total = f.owner.coins + f.helper.coins;
    expect(f.t.apply(f.helper, { kind: "settle" }, "test")).toBe(true);
    expect(f.helper.coins).toBe(44); expect(f.owner.coins + f.helper.coins).toBe(total);
    expect(f.t.apply(f.helper, { kind: "settle" }, "test")).toBe(false);
    expect(f.t.events.find((e) => e.kind === "town.built")?.payload?.project).toBe("A home");
  });

  it("does not count work before acceptance, repeat work, or another person's labor", () => {
    const f = fixture(); f.t.apply(f.helper, { kind: "work" }, "test"); promise(f);
    f.t.apply(f.helper, { kind: "work" }, "test"); f.t.apply(f.owner, { kind: "work" }, "test");
    expect(f.helper.deals[0]!.construction!.done).toBe(0);
    expect(f.site.site!.labor).toBe(2);
    expect(f.t.apply(f.helper, { kind: "settle" }, "test")).toBe(false);
  });

  it("keeps labor and both sides of the promise through a serialized restart", () => {
    const f = fixture(); promise(f); f.t.apply(f.helper, { kind: "work" }, "test");
    const snap = JSON.parse(JSON.stringify(f.t.snapshot())) as TownSnapshot;
    const back = new Town({ seed: 7, brain: mind }); back.restore(snap);
    const helper = back.agents.get(f.helper.id)!;
    back.apply(helper, { kind: "work" }, "test");
    expect(back.places.get(f.site.id)!.site!.labor).toBe(1);
    expect(helper.deals[0]!.construction!.done).toBe(1);
    back.day++; back.t += 1440; back.apply(helper, { kind: "work" }, "test");
    expect(helper.deals[0]!.construction!.done).toBe(2);
    expect(back.agents.get(f.owner.id)!.deals[0]!.construction!.done).toBe(2);
    expect(back.agents.get(f.owner.id)!.projects[0]!.construction!.labor).toBe(2);
    expect(Perception.parse(back.perceive(helper)).self.deals![0]!.construction).toMatchObject({ done: 2, mornings: 2 });
  });

  it("does not allow reflection to announce an unfinished building as complete", async () => {
    const f = fixture(); f.t.t = 1439;
    await f.t.tick();
    expect(f.owner.projects[0]).toMatchObject({ done: false, construction: { labor: 0 } });
    expect(f.owner.projects[0]!.progress).not.toBe("Finished!");
  });

  it("keeps completed work payable when the builder lacks coins and the deadline passes", async () => {
    const f = fixture(); promise(f, 1); f.t.apply(f.helper, { kind: "work" }, "test");
    f.owner.coins = 0;
    expect(f.t.apply(f.helper, { kind: "settle" }, "test")).toBe(false);
    f.helper.deals[0]!.due = 0; f.t.t = 1439; await f.t.tick();
    expect(f.helper.deals[0]!.state).toBe("open");
    f.owner.asleep = f.helper.asleep = false; f.owner.location = f.helper.location = f.site.id; f.owner.coins = 4;
    expect(f.t.apply(f.helper, { kind: "settle" }, "test")).toBe(true);
  });

  it("refuses impossible and stale building offers", () => {
    const f = fixture();
    expect(f.t.apply(f.helper, { kind: "offer", to: f.owner.id, what: "too much work", construction: { site: f.site.id, mornings: 7 } }, "test")).toBe(false);
    expect(f.t.apply(f.owner, { kind: "offer", to: f.helper.id, what: "wrong builder", construction: { site: f.site.id, mornings: 1 } }, "test")).toBe(false);
    expect(f.t.apply(f.helper, { kind: "offer", to: f.owner.id, what: "all six mornings", construction: { site: f.site.id, mornings: 6 } }, "test")).toBe(true);
    f.t.apply(f.owner, { kind: "work" }, "test");
    expect(f.t.apply(f.owner, { kind: "accept" }, "test")).toBe(false);
    expect(f.t.apply(f.owner, { kind: "refuse" }, "test")).toBe(true);
  });

  it("uses the named person when settling, and never reuses a paid deal id after restart", () => {
    const f = fixture();
    const other = f.t.addAgent({ persona: persona("Other") }); other.location = f.site.id;
    f.t.apply(f.helper, { kind: "offer", to: other.id, what: "keep company" }, "test");
    f.t.apply(other, { kind: "accept" }, "test");
    promise(f, 1);
    const id = f.helper.deals[1]!.id;
    expect(f.t.apply(f.helper, { kind: "settle", to: f.owner.id }, "test")).toBe(false);
    f.t.apply(f.helper, { kind: "work" }, "test");
    expect(f.t.apply(f.helper, { kind: "settle", to: f.owner.id }, "test")).toBe(true);
    expect(f.helper.deals[0]!.state).toBe("open");
    const back = new Town({ seed: 7, brain: mind }); back.restore(JSON.parse(JSON.stringify(f.t.snapshot())));
    const helper = back.agents.get(f.helper.id)!;
    back.apply(helper, { kind: "offer", to: f.owner.id, what: "another morning", construction: { site: f.site.id, mornings: 1 } }, "test");
    expect(helper.deals.at(-1)!.id).toBeGreaterThan(id);
  });

  it("attaches an existing intention to construction and refuses to attach it to a second site", () => {
    const t = new Town({ seed: 7, brain: mind }); t.t = 540;
    const a = t.addAgent({ persona: persona("Builder") }); a.location = "shore-1";
    a.projects.push({ title: "A home", why: "a roof", progress: "saving", since: 1, done: false });
    t.apply(a, { kind: "build", at: a.location, what: "house", project: "A home" }, "test");
    expect(a.projects).toHaveLength(1);
    a.location = "lane-1";
    expect(t.apply(a, { kind: "build", at: a.location, what: "house", project: "A home" }, "test")).toBe(false);
  });
});
