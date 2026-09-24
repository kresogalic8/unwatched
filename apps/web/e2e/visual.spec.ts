import { expect, test, type Page } from "@playwright/test";

/**
 * The island's looks, photographed. Every picture is taken on a frozen clock with a seeded Math.random, so the water, the clouds,
 * the gulls and the figures' idle sway are the same on every run; the town itself is the mock one on a fixed seed.
 */
async function freeze(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let a = 20260924; Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    try { localStorage.setItem("unwatched.analytics.v1", "declined"); } catch {} // no consent banner over the pictures
  });
  await page.clock.install({ time: new Date("2026-06-21T09:00:00Z") });
}

/** open the town at a moment and a look, let it settle for a few seconds of its own time, and hide what is not the island */
async function town(page: Page, query: string): Promise<void> {
  await freeze(page);
  await page.goto(`/town?clean=1&${query}`);
  await page.locator('[data-world-ready="1"]').waitFor({ timeout: 60_000 });
  await page.clock.runFor(6000);
}

const SHOTS: [string, string][] = [
  ["town-noon", "hour=12&weather=clear&season=summer&look=town"],
  ["town-street", "hour=12&weather=clear&season=summer&look=town&at=market&zoom=1.6"],
  ["town-dusk", "hour=19&weather=clear&season=summer&look=town&at=inn&zoom=1.2"],
  ["town-night", "hour=23&weather=clear&season=summer&look=town"],
  ["town-snow", "hour=11&weather=snow&season=winter&look=town&at=market&zoom=1.2"],
  ["town-miniature", "hour=12&weather=clear&season=summer&look=miniature"],
];

for (const [name, query] of SHOTS) {
  test(name, async ({ page }) => {
    await town(page, query);
    await expect(page).toHaveScreenshot(`${name}.png`);
  });
}

test("interiors", async ({ page }) => {
  await freeze(page);
  await page.goto("/experiments/interiors");
  await page.locator("canvas").waitFor({ timeout: 60_000 });
  for (const room of ["Konoba", "Home", "Smithy", "Fish house"]) {
    await page.getByRole("button", { name: room, exact: true }).click();
    await page.clock.runFor(1500);
    await expect(page.locator("canvas")).toHaveScreenshot(`interior-${room.toLowerCase().replace(" ", "-")}.png`);
  }
  await page.getByRole("button", { name: "Day" }).click(); await page.clock.runFor(1500);
  await expect(page.locator("canvas")).toHaveScreenshot("interior-fish-house-night.png");
});

test("figures", async ({ page }) => {
  await freeze(page);
  await page.goto("/experiments/figures");
  await page.locator("canvas").waitFor({ timeout: 60_000 });
  await page.clock.runFor(2000);
  await expect(page.locator("canvas")).toHaveScreenshot("figures.png");
});
