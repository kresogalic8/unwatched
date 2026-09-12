import { describe, it, expect, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileStore } from "../src/file.ts";
import { TownStore } from "../src/index.ts";
import { Town } from "@unwatched/engine";
import type { Brain, AgentState, Tier } from "@unwatched/engine";
import type { Perception, ActionProposal } from "@unwatched/protocol";

const persona = (n: string) => ({ name: n, age: 30, origin: "the mainland", summary: "A person.", want: "a quiet life", fear: "debt", secret: "none", strangers: "polite", advice: "listens", traits: { warmth: 0.5, pride: 0.4, caution: 0.5, honesty: 0.7, ambition: 0.5 } });
const none: Brain = {
  name: "none",
  async decide(_p: Perception, _a: AgentState, _t: Tier): Promise<ActionProposal> { return { action: { kind: "wait" }, remember: [] }; },
  async converse() { throw new Error("no"); }, async reflect() { throw new Error("no"); }, async plan() { throw new Error("no"); },
  async digest() { return { text: "", headline: "" }; }, async child() { throw new Error("no"); }, async writePaper() { throw new Error("no"); }, async life() { throw new Error("no"); },
  async judge() { return { happened: "it passed", plausible: true, coins_spent: 0, item_gained: null, item_lost: null, eases: null, trust: [] }; },
};

const fresh = () => new FileStore(mkdtempSync(join(tmpdir(), "uw-store-")), "test");

describe("the file record", () => {
  it("keeps a building, its project and both copies of paid-work progress in file and Postgres snapshots", async () => {
    const town = new Town({ seed: 3, brain: none }); town.t = 540;
    const owner = town.addAgent({ persona: persona("Builder") });
    const helper = town.addAgent({ persona: persona("Helper") });
    owner.location = helper.location = "shore-1";
    expect(town.apply(owner, { kind: "build", what: "house", at: "shore-1", project: "A home" }, "test")).toBe(true);
    expect(town.apply(helper, { kind: "offer", to: owner.id, what: "two mornings of work", coins: 4, construction: { site: "shore-1", mornings: 2 } }, "test")).toBe(true);
    town.apply(owner, { kind: "accept" }, "test"); town.apply(helper, { kind: "work" }, "test");
    const s = fresh(); await s.ensureTown("The island", 3); await s.snapshot(town);
    const back = new Town({ seed: 3, brain: none }); back.restore((await s.loadSnapshot())!);
    const h = back.agents.get(helper.id)!;
    back.apply(h, { kind: "work" }, "test");
    expect(back.places.get("shore-1")!.site!.labor).toBe(1);
    expect(h.deals[0]!.construction!.done).toBe(1);
    expect(back.agents.get(owner.id)!.projects[0]!.construction!.labor).toBe(1);

    // Capture the actual PostgREST writes. No external database or network is used.
    const writes: { url: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", async (url: unknown, init: RequestInit) => {
      writes.push({ url: String(url), body: JSON.parse(String(init.body)) });
      return new Response(null, { status: 204 });
    });
    try {
      const pg = new TownStore("https://store.test", "test-service-key", "test");
      await pg.snapshot(back);
      const agents = writes.find((w) => w.url.includes("/agents"))!.body as { id: string; state: { deals: unknown[]; projects: unknown[] } }[];
      expect(agents.find((a) => a.id === helper.id)!.state.deals[0]).toMatchObject({ construction: { done: 1, mornings: 2 } });
      expect(agents.find((a) => a.id === owner.id)!.state.deals[0]).toMatchObject({ construction: { done: 1 } });
      expect(agents.find((a) => a.id === owner.id)!.state.projects[0]).toMatchObject({ construction: { labor: 1 } });
      expect(writes.find((w) => w.url.includes("/towns"))!.body).toMatchObject({ civic: { nextDealId: 2 }, places: expect.arrayContaining([expect.objectContaining({ id: "shore-1", site: expect.objectContaining({ workedDay: { [helper.id]: 1 } }) })]) });
    } finally { vi.unstubAllGlobals(); }
  });
  it("delivers a letter once: one posted through the API is already read, one written straight in waits for the hour", async () => {
    const s = fresh();
    await s.saveLetter("a1", "owner", "to_agent", "Find work first.", 100, 100); // the API delivered it on the spot
    await s.saveLetter("a1", "owner", "to_agent", "And write.", 110);            // another process wrote it; the engine has not seen it
    const waiting = await s.undeliveredLetters();
    expect(waiting.map((l) => l.text)).toEqual(["And write."]);
    await s.markDelivered(waiting.map((l) => l.id), 120);
    expect(await s.undeliveredLetters()).toEqual([]);
    const life = await s.lifeOf("a1"); expect(life.letters).toHaveLength(2);
  });
  it("keeps what an owner asked to be told, on by default, and the day the morning mail went", async () => {
    const s = fresh();
    expect(await s.ownerPrefs("mira")).toEqual({ ownerId: "mira", notifyDigest: true, notifyLetters: true, lastMailedDay: null });
    await s.saveOwnerPrefs({ ownerId: "mira", notifyDigest: false, notifyLetters: true, lastMailedDay: 4 });
    expect(await s.ownerPrefs("mira")).toMatchObject({ notifyDigest: false, lastMailedDay: 4 });
    await s.deleteOwner("mira");
    expect((await s.ownerPrefs("mira")).notifyDigest).toBe(true);
  });
  it("keeps where an owner's reading of each citizen stands", async () => {
    const s = fresh();
    expect(await s.ownerRead("mira", "a1")).toEqual({ ownerId: "mira", agentId: "a1", lastDigestT: null, lastLetterMailDay: null });
    await s.saveOwnerRead({ ownerId: "mira", agentId: "a1", lastDigestT: 4321, lastLetterMailDay: null });
    await s.saveOwnerRead({ ownerId: "mira", agentId: "a1", lastDigestT: 4321, lastLetterMailDay: 3 });
    expect(await s.ownerRead("mira", "a1")).toMatchObject({ lastDigestT: 4321, lastLetterMailDay: 3 });
    expect((await s.ownerRead("mira", "a2")).lastDigestT).toBeNull();
  });
  it("gives a dev name an inbox only through UW_DEV_EMAILS", async () => {
    const s = fresh();
    expect(await s.ownerEmail("mira")).toBeNull();
    process.env.UW_DEV_EMAILS = "mira=mira@example.com, tomo=tomo@example.com";
    expect(await s.ownerEmail("tomo")).toBe("tomo@example.com");
    delete process.env.UW_DEV_EMAILS;
  });
  it("keeps who has voted, so a restart does not let the council vote twice", async () => {
    const s = fresh();
    const town = new Town({ seed: 3, brain: none });
    const p0 = town.addAgent({ persona: persona("Proposer") }); const p1 = town.addAgent({ persona: persona("Voter") });
    for (const x of [p0, p1]) x.location = "council";
    town.apply(p0, { kind: "propose", law: "a tax on wages of one coin" }, "test");
    expect(town.apply(p1, { kind: "vote", proposal: "a tax on wages", yes: true }, "test")).toBe(true);
    await s.ensureTown("The island", 3); await s.snapshot(town);
    const back = new Town({ seed: 3, brain: none }); back.restore((await s.loadSnapshot())!);
    const voter = back.agents.get(p1.id)!; voter.location = "council";
    expect(back.apply(voter, { kind: "vote", proposal: "a tax on wages", yes: true }, "test")).toBe(false);
    expect(back.laws[0]!.yes).toBe(2);
  });
  it("gives every letter its own id, even after an owner is forgotten", async () => {
    const s = fresh();
    await s.saveLetter("a1", "gone", "to_agent", "First.", 10);
    await s.saveLetter("a1", "stays", "to_agent", "Second.", 20);
    await s.deleteOwner("gone");
    await s.saveLetter("a1", "stays", "to_agent", "Third.", 30);
    const ids = (await s.undeliveredLetters()).map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("puts a letter back in the post when the town rewinds past its delivery", async () => {
    const s = fresh();
    const town = new Town({ seed: 4, brain: none }); town.addAgent({ persona: persona("Reader") });
    await s.ensureTown("The island", 4); await s.snapshot(town); // the record stands at this minute
    await s.saveLetter("a1", "owner", "to_agent", "Read this.", town.t + 30, town.t + 30); // delivered after it, then the process died
    await s.saveLetter("a1", "owner", "to_owner", "Never written.", town.t + 40, town.t + 40);
    await s.loadSnapshot();
    expect((await s.undeliveredLetters()).map((l) => l.text)).toEqual(["Read this."]);
    expect((await s.lifeOf("a1")).letters.map((l) => l.text)).not.toContain("Never written.");
  });
});
