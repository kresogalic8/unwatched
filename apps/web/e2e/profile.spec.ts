import { writeFileSync, mkdirSync } from "node:fs";
import { test } from "@playwright/test";

/** Where a slowed-down frame's time goes, function by function: a CPU profile of the street at noon with the CPU at 4×. PROFILE=1 to run. */
test.skip(!process.env.PROFILE, "set PROFILE=1 to profile");
test.use({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });

test("profile the street", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await page.addInitScript(() => { try { localStorage.setItem("unwatched.analytics.v1", "declined"); } catch {} });
  const cdp = await page.context().newCDPSession(page);
  await page.goto(`/town?hour=${process.env.PROFILE_HOUR ?? 12}&clean=1&weather=clear&season=summer&look=town&at=market&zoom=1.4`);
  await page.locator('[data-world-ready="1"]').waitFor({ timeout: 90_000 }); await page.waitForTimeout(3000);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await cdp.send("Profiler.start");
  await page.waitForTimeout(5000);
  const { profile } = await cdp.send("Profiler.stop") as { profile: { nodes: { id: number; callFrame: { functionName: string; url: string; lineNumber: number }; hitCount?: number; children?: number[] }[]; samples: number[]; timeDeltas: number[] } };
  const self = new Map<number, number>(); profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
  const byName = new Map<string, number>();
  for (const n of profile.nodes) { const k = `${n.callFrame.functionName || "(anonymous)"} ${n.callFrame.url.split("/").slice(-1)[0]}:${n.callFrame.lineNumber}`; byName.set(k, (byName.get(k) ?? 0) + (self.get(n.id) ?? 0)); }
  const total = [...byName.values()].reduce((a, b) => a + b, 0);
  const top = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${(100 * v / total).toFixed(1).padStart(5)}%  ${k}`);
  mkdirSync("test-results", { recursive: true }); writeFileSync("test-results/profile.txt", top.join("\n") + "\n"); console.log(top.join("\n"));
});
