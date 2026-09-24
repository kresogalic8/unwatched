import { defineConfig } from "@playwright/test";

/**
 * Visual regression: the island photographed at fixed hours, weathers and looks, and compared with the pictures kept in e2e/__screenshots__.
 * Playwright starts its own town (the mock brain on a fixed seed, a clock that barely moves, no keys, no store) and its own web app pointed
 * at it, so nothing depends on the island running on this machine. Baselines are per platform: a Mac draws antialiasing differently from
 * the Linux runner, so each keeps its own. Refresh them with `pnpm --filter @unwatched/web test:visual --update-snapshots`.
 */
const API_PORT = Number(process.env.VISUAL_API_PORT ?? 4100), WEB_PORT = Number(process.env.VISUAL_WEB_PORT ?? 3100);
// the root .env configures the real island; blank every key it sets so the test town is the bare mock one
const BLANK = Object.fromEntries(["OPENROUTER_API_KEY", "ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "UW_DEV_OWNER", "UW_OPS_TOKEN", "UW_TOWN_ID", "GEMINI_API_KEY", "RECRAFT_API_KEY", "UW_HARBORS", "UW_BOAT_SECRET", "UW_TOWN_NAME", "UW_REAL_WORLD", "UW_PUBLIC_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "RESEND_API_KEY", "MAIL_FROM"].map((k) => [k, ""]));

export default defineConfig({
  testDir: "e2e",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}-{platform}{ext}",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.015, threshold: 0.2, animations: "disabled" } },
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.PW_CHROME || undefined, args: ["--use-gl=angle", "--ignore-gpu-blocklist"] },
  },
  webServer: [
    {
      command: "pnpm --filter @unwatched/server start",
      port: API_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...BLANK, PORT: String(API_PORT), UW_BRAIN: "mock", UW_STORE: "none", UW_SEED: "42", UW_MS_PER_SIM_MINUTE: "600000", NEXT_PUBLIC_API_URL: "" },
    },
    {
      // a production build, so the pictures are the ones people get (and it does not collide with a `next dev` already running here)
      command: `pnpm exec next build && pnpm exec next start -p ${WEB_PORT}`,
      port: WEB_PORT,
      reuseExistingServer: false,
      timeout: 420_000,
      env: { ...BLANK, NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`, UW_EXPERIMENTS: "1" },
    },
  ],
});
