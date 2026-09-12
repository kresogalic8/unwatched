import { defineConfig } from "vitest/config";

// The engine's tests are days of the island, minute by minute, and twenty of them run at once.
// Five seconds is a unit test's budget, not a simulation's: give them room so a loaded machine does not fail a green suite.
export default defineConfig({ test: { testTimeout: 30_000, hookTimeout: 30_000 } });
