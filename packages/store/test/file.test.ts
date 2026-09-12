import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileStore } from "../src/file.ts";

const fresh = () => new FileStore(mkdtempSync(join(tmpdir(), "uw-store-")), "test");

describe("the file record", () => {
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
});
