import { writeFileSync, mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";

/**
 * How the town runs on a phone, as near as a desktop can say: a phone's screen (412×915 at 2.6×, touch), the CPU slowed four times
 * the way DevTools approximates a mid-range Android, and frame times sampled from requestAnimationFrame for a few seconds per scene.
 * Each effect is also switched off on its own (?nofx=...) to price it. The GPU is this machine's, not a phone's: GPU-bound costs read
 * low here, and the CPU numbers are the trustworthy part. Opt in with PERF=1; writes test-results/perf-mobile.md.
 *   PERF=1 pnpm --filter @unwatched/web test:visual perf
 */
test.skip(!process.env.PERF, "set PERF=1 to measure");
test.use({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });

const BASE = "clean=1&weather=clear&season=summer&look=town&at=market&zoom=1.4";
const SCENES: [string, string][] = [
  ["noon, everything on", `hour=12&${BASE}`],
  ["noon, as before (every step draws, no governor)", `hour=12&${BASE}&nofx=stepdraw,governor`],
  ["noon, no post (grade, bloom)", `hour=12&${BASE}&nofx=post,grade`],
  ["noon, no water shader", `hour=12&${BASE}&nofx=water`],
  ["noon, no soft shadows", `hour=12&${BASE}&nofx=softshadow`],
  ["noon, no face light", `hour=12&${BASE}&nofx=facelight`],
  ["night, everything on", `hour=23&${BASE}`],
  ["night, as before (every step draws, no governor)", `hour=23&${BASE}&nofx=stepdraw,governor`],
  ["night, no post (bloom)", `hour=23&${BASE}&nofx=post`],
  ["snow", `hour=11&weather=snow&season=winter&clean=1&look=town&at=market&zoom=1.4`],
  ["miniature", `hour=12&weather=clear&season=summer&clean=1&look=miniature`],
  ["whole island", `hour=12&weather=clear&season=summer&clean=1&look=town`],
];

type Row = { scene: string; throttle: number; fps: number; median: number; p95: number; cpu: number; js: Record<string, number> };

async function frames(page: Page, ms: number): Promise<number[]> {
  return page.evaluate((ms) => new Promise<number[]>((done) => { const out: number[] = []; let last = performance.now(); const start = last; const f = (now: number) => { out.push(now - last); last = now; if (now - start < ms) requestAnimationFrame(f); else done(out); }; requestAnimationFrame(f); }), ms);
}
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0; };

test("mobile frame times", async ({ page }) => {
  test.setTimeout(20 * 60_000);
  await page.addInitScript(() => { try { localStorage.setItem("unwatched.analytics.v1", "declined"); } catch {} });
  const cdp = await page.context().newCDPSession(page);
  const rows: Row[] = []; let gpu = "";
  for (const throttle of [4, 1]) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
    for (const [scene, query] of SCENES) {
      await page.goto(`/town?${query}`);
      await page.locator('[data-world-ready="1"]').waitFor({ timeout: 90_000 });
      await page.waitForTimeout(3000); // textures up, the first frames' compiling done
      if (!gpu) gpu = await page.evaluate(() => { const gl = document.createElement("canvas").getContext("webgl2"); const ext = gl?.getExtension("WEBGL_debug_renderer_info"); return ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "unknown"; });
      const before = await page.evaluate(() => ({ ...(window as unknown as { __ftperf: Record<string, number> }).__ftperf }));
      const t = await frames(page, 6000);
      const after = await page.evaluate(() => ({ ...(window as unknown as { __ftperf: Record<string, number> }).__ftperf }));
      // the town's own count of frames, and the milliseconds each section spent in them; "idle" is the wait for the next frame, not work
      const n = Math.max(1, (after.frames ?? 0) - (before.frames ?? 0));
      const js = Object.fromEntries(Object.keys(after).filter((k) => k !== "frames" && k !== "idle" && k !== "start").map((k) => [k, ((after[k] ?? 0) - (before[k] ?? 0)) / n]).filter(([, v]) => (v as number) > 0.05)) as Record<string, number>;
      const cpu = Object.values(js).reduce((a, b) => a + b, 0);
      const median = q(t, 0.5); rows.push({ scene, throttle, fps: 1000 / median, median, p95: q(t, 0.95), cpu, js });
      console.log(`${throttle}× ${scene}: ${(1000 / median).toFixed(0)} fps, median ${median.toFixed(1)} ms, p95 ${q(t, 0.95).toFixed(1)} ms, work ${cpu.toFixed(1)} ms/frame`);
    }
  }
  const lines = [`# The town on a phone (emulated)`, "", `412×915 at 2.625×, touch; renderer resolution capped at 2. GPU: ${gpu}. CPU slowed 1× and 4×.`, "", "| CPU | scene | fps | median ms | p95 ms | work ms/frame | biggest sections (ms per frame) |", "|---|---|---|---|---|---|---|"];
  for (const r of rows) lines.push(`| ${r.throttle}× | ${r.scene} | ${r.fps.toFixed(0)} | ${r.median.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.cpu.toFixed(1)} | ${Object.entries(r.js).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(", ")} |`);
  mkdirSync("test-results", { recursive: true }); writeFileSync("test-results/perf-mobile.md", lines.join("\n") + "\n");
});
