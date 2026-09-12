#!/usr/bin/env node
// Cuts a release: bumps every package to one version, moves the Unreleased section of CHANGELOG.md under that version with today's date,
// commits, and makes an annotated tag. It does not push; the last line tells you the command. Usage: pnpm release minor | patch | major | 0.3.0
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { globSync } from "node:fs";

const sh = (cmd) => execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] }).toString().trim();
const arg = process.argv[2];
if (!arg) { console.error("usage: pnpm release <major|minor|patch|x.y.z>"); process.exit(2); }
if (sh("git branch --show-current") !== "main") { console.error("release from main"); process.exit(1); }
if (sh("git status --porcelain")) { console.error("the tree is not clean; commit or stash first"); process.exit(1); }

const root = JSON.parse(readFileSync("package.json", "utf8"));
const [maj, min, pat] = String(root.version ?? "0.0.0").split(".").map(Number);
const next = /^\d+\.\d+\.\d+$/.test(arg) ? arg : arg === "major" ? `${maj + 1}.0.0` : arg === "minor" ? `${maj}.${min + 1}.0` : arg === "patch" ? `${maj}.${min}.${pat + 1}` : null;
if (!next) { console.error(`not a version or a bump: ${arg}`); process.exit(2); }
const date = new Date().toISOString().slice(0, 10); // this script runs on a laptop, not in the engine

// the changelog: Unreleased becomes the version, and a fresh Unreleased goes above it
let log = readFileSync("CHANGELOG.md", "utf8");
if (!/^## \[Unreleased\]/m.test(log)) { console.error("CHANGELOG.md has no Unreleased section"); process.exit(1); }
const unreleasedBody = log.split(/^## \[Unreleased\]\s*$/m)[1]?.split(/^## \[/m)[0] ?? "";
if (!/^- /m.test(unreleasedBody)) { console.error("nothing under Unreleased in CHANGELOG.md; write what changed first"); process.exit(1); }
const fresh = "## [Unreleased]\n\n### Added\n\n### Changed\n\n### Fixed\n\n";
log = log.replace(/^## \[Unreleased\]\s*$/m, `${fresh}## [${next}] - ${date}`);
log = log.replace(/^\[Unreleased\]:\s+\S+$/m, `[Unreleased]: https://github.com/kresogalic8/unwatched/compare/v${next}...HEAD\n[${next}]: https://github.com/kresogalic8/unwatched/compare/v${root.version}...v${next}`);
// drop the empty subsection headings the release inherited, so the notes read clean
log = log.replace(new RegExp(`(## \\[${next.replace(/\./g, "\\.")}\\][^\\n]*\\n)([\\s\\S]*?)(?=\\n## \\[|\\n\\[)`), (m, head, body) => head + body.replace(/\n### [A-Za-z]+\n+(?=### |\n\[|$)/g, "\n"));
writeFileSync("CHANGELOG.md", log);

// every package moves together: the island is one version
const files = ["package.json", ...globSync("packages/*/package.json"), ...globSync("apps/*/package.json")];
for (const f of files) { const j = JSON.parse(readFileSync(f, "utf8")); j.version = next; writeFileSync(f, JSON.stringify(j, null, 2) + "\n"); }

sh("pnpm typecheck"); sh("pnpm test");
sh(`git add CHANGELOG.md ${files.join(" ")}`);
sh(`git commit -q -m "Release v${next}"`);
sh(`git tag -a v${next} -m "Unwatched v${next}"`);
console.log(`v${next} is committed and tagged. Push it and the release workflow publishes the notes:\n  git push origin main v${next}`);
