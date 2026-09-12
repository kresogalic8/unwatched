#!/usr/bin/env node
// Prints one version's section of CHANGELOG.md: node scripts/changelog-section.mjs 0.2.0
import { readFileSync } from "node:fs";
const version = process.argv[2];
if (!version) { console.error("usage: changelog-section.mjs <version>"); process.exit(2); }
const lines = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8").split("\n");
const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
if (start < 0) { console.error(`CHANGELOG.md has no section for ${version}`); process.exit(1); }
let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
if (end < 0) end = lines.findIndex((l, i) => i > start && /^\[[^\]]+\]:\s+http/.test(l));
if (end < 0) end = lines.length;
console.log(lines.slice(start + 1, end).join("\n").trim());
