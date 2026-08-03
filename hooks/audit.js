#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { STATE_DIR, loadJSON, findPolicyFile } = require("./lib.js");

// Shell-free so a repo path with odd characters can't be misinterpreted.
function git(cwd, args) {
  try {
    return { ok: true, out: execFileSync("git", ["-C", cwd, ...args], { stdio: ["ignore", "pipe", "ignore"], timeout: 10000 }).toString().trim() };
  } catch (e) {
    return { ok: false, out: "" };
  }
}

// Surface which policy governed the session and whether it's the trusted default
// or an in-repo override — and if the latter, whether that override is committed
// or an uncommitted change an agent could have slipped in this session. This is
// how a self-neutered gate becomes visible after the fact.
function reportPolicy(cwd) {
  const { path: pfile, source } = findPolicyFile(cwd || process.cwd());
  console.log("\nActive gate policy:");
  if (source === "default") {
    console.log(`- bundled default (${pfile}) — no in-repo override in effect`);
    return;
  }
  console.log(`- in-repo override: ${pfile}`);
  const dir = path.dirname(path.dirname(pfile)); // repo-ish dir containing .handover/
  const tracked = git(dir, ["ls-files", "--error-unmatch", pfile]).ok;
  if (!tracked) {
    console.log("  ⚠ this policy file is NOT tracked by git — it cannot be reviewed in a diff or a PR. Treat any deny/ask rule it drops as suspect.");
    return;
  }
  const dirty = git(dir, ["status", "--porcelain", pfile]).out;
  if (dirty) console.log("  ⚠ tracked but has UNCOMMITTED changes — someone (possibly an agent this session) edited the gate's own rules. Diff it before trusting the gate.");
  else console.log("  ✓ tracked and clean (committed) — reviewable in git history.");
}

let files = [];
try {
  files = fs
    .readdirSync(STATE_DIR)
    .filter((f) => !f.startsWith("."))
    .map((f) => path.join(STATE_DIR, f));
} catch (e) {}

if (!files.length) {
  console.log("No Handover session state found yet.");
  process.exit(0);
}

files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
const s = loadJSON(files[0]) || {};
const c = s.counts || {};

console.log(`Most recent session state: ${files[0]}`);
if (files.length > 1) {
  console.log("(If you have more than one Claude Code session running, this is whichever was most recently active, not necessarily this one.)");
}
console.log(`Auto-approved reads (prompts saved): ${c.allow || 0}`);
console.log(`Asked for approval: ${c.ask || 0}`);
console.log(`Denied by policy: ${c.deny || 0}`);

const denials = s.denials || [];
if (denials.length) {
  console.log("\nDenials:");
  for (const d of denials) console.log(`- [${d.rule || "route-around"}] via ${d.tool}`);
}

const loop = Object.entries(s.loop || {}).filter(([, n]) => n >= 2);
if (loop.length) {
  console.log("\nRepeating failures flagged by the loop detector:");
  for (const [fp, n] of loop) console.log(`- x${n}: ${fp}`);
}

reportPolicy(s.cwd);
