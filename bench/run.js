#!/usr/bin/env node
"use strict";
// Handover bench: measure whether a handoff artifact actually transfers.
// Usage: node bench/run.js [scenario-dir]   (default: all scenarios under bench/scenarios)
//
// Two layers:
//   1. Deterministic (runs now): lint score + "trap coverage" — for each planted
//      trap, does the artifact contain the negative knowledge (guard_pattern)
//      that would steer a cold agent away from it? Same input, same numbers.
//   2. Empirical (agent-in-the-loop, gated): give a cold agent ONLY the artifact
//      plus the scenario repo, let it work, then run each trap's `detect_fell_in`
//      against the resulting repo. That step needs a live agent runner, so it is
//      documented here and left pluggable rather than invoked automatically.
const fs = require("fs");
const path = require("path");
const { evaluate } = require("../bin/lib/handover-doc.js");

function coverage(text, traps) {
  const covered = traps.filter((t) => new RegExp(t.guard_pattern, "i").test(text));
  return { covered: covered.map((t) => t.id), n: covered.length, total: traps.length };
}

function scoreArtifact(file, traps) {
  const src = fs.readFileSync(file, "utf8");
  const ev = evaluate(src);
  const cov = coverage(src, traps);
  // Handoff quality: half the lint score, half trap coverage. Both matter — a
  // well-formatted doc that omits the traps still gets an agent hurt.
  const quality = Math.round(ev.score * 0.5 + (cov.n / cov.total) * 100 * 0.5);
  return { score: ev.score, valid: ev.valid, coverage: cov, quality };
}

function runScenario(dir) {
  const traps = JSON.parse(fs.readFileSync(path.join(dir, "traps.json"), "utf8")).traps;
  const name = path.basename(dir);
  console.log(`\n=== scenario: ${name} (${traps.length} planted traps) ===`);
  const artifacts = ["good.handover.md", "bad.handover.md"].filter((f) => fs.existsSync(path.join(dir, f)));
  const rows = [["artifact", "lint", "valid", "traps covered", "quality"]];
  const results = {};
  for (const a of artifacts) {
    const r = scoreArtifact(path.join(dir, a), traps);
    results[a] = r;
    rows.push([a, `${r.score}/100`, r.valid ? "yes" : "NO", `${r.coverage.n}/${r.coverage.total}`, `${r.quality}/100`]);
  }
  // "no artifact" is the control: nothing to transfer, zero coverage.
  rows.push(["(no artifact)", "0/100", "NO", `0/${traps.length}`, "0/100"]);

  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)));
  for (const r of rows) console.log("  " + r.map((c, i) => String(c).padEnd(w[i])).join("  "));

  if (results["good.handover.md"] && results["bad.handover.md"]) {
    const d = results["good.handover.md"].quality - results["bad.handover.md"].quality;
    console.log(`\n  delta (good - bad): +${d} quality points; trap coverage ` +
      `${results["good.handover.md"].coverage.n}/${traps.length} vs ${results["bad.handover.md"].coverage.n}/${traps.length}.`);
    console.log("  Empirical trial (gated): give a cold agent only each artifact, then run detect_fell_in per trap.");
  }
  return results;
}

const target = process.argv[2];
const base = path.join(__dirname, "scenarios");
const dirs = target
  ? [path.resolve(target)]
  : fs.readdirSync(base).map((d) => path.join(base, d)).filter((d) => fs.statSync(d).isDirectory());

console.log("Handover bench — deterministic layer (lint + trap coverage)");
for (const d of dirs) runScenario(d);
console.log("");
