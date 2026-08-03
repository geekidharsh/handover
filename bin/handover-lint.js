#!/usr/bin/env node
"use strict";
// Handover lint: score a handover document and, optionally, check it against the
// live repo. Deterministic — no LLM, no network. Usage:
//   node bin/handover-lint.js <file.md> [--json] [--min=N] [--repo] [--verify] [--strict]
//
// Two clearly separated layers:
//   STRUCTURE   — the pure 0-100 rubric from bin/lib/handover-doc.js. Always on.
//                 Same input, same score. Judges shape only; cannot know truth.
//   VERIFICATION— repo-aware truth checks, opt-in because they only mean anything
//                 when run inside the doc's own repo (the bundled example points
//                 at a fictional repo, so verifying it here would be meaningless):
//                   --repo    read-only: does true_at_sha exist, how far has HEAD
//                             drifted since, is iso_date in the future.
//                   --verify  everything --repo does, plus actually run verify_cmd
//                             (the only thing that turns "done" from belief to fact).
//                 This half catches a confident-but-wrong doc the score would pass.
//
// Exit codes: 0 = ok; 1 = structurally invalid, below --min, a real verification
// failure, or (under --strict) a drift/unproven warning. 2 = usage error.
const fs = require("fs");
const { execSync, execFileSync } = require("child_process");
const { evaluate, localISODate, maskBody } = require("./lib/handover-doc.js");

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const asJson = args.includes("--json");
// --claims additionally runs each claim-table row's own verify command; it
// implies --verify (same trust level: you are opting into running the doc's
// commands).
const runClaims = args.includes("--claims");
// --verify runs verify_cmd; --run-verify kept as a back-compat alias.
const runVerify = args.includes("--verify") || args.includes("--run-verify") || runClaims;
// Repo-aware read-only checks run under --repo or (implied by) --verify.
const doRepo = args.includes("--repo") || runVerify;
const strict = args.includes("--strict");
const minArg = args.find((a) => a.startsWith("--min="));
const min = minArg ? Number(minArg.split("=")[1]) : null;

if (!file) {
  console.error("usage: handover-lint.js <file.md> [--json] [--min=N] [--repo] [--verify] [--claims] [--strict]");
  process.exit(2);
}

// git(args) runs git WITHOUT a shell (execFileSync), so a value read from the
// handoff document can never be interpreted as a command. This is the boundary
// that makes the repo checks safe to run on an untrusted doc. Never throws.
function git(args) {
  try {
    return { ok: true, out: execFileSync("git", args, { stdio: ["ignore", "pipe", "ignore"], timeout: 20000 }).toString().trim() };
  } catch (e) {
    return { ok: false, out: "" };
  }
}

// sh(cmd) runs a command THROUGH a shell. Used only for the doc's own verify_cmd
// under --verify — i.e. a command the user explicitly opted into running, the
// same trust level as `make test`. Never used with header-derived values.
function sh(cmd, timeout = 120000) {
  try {
    return { ok: true, out: execSync(cmd, { stdio: ["ignore", "pipe", "ignore"], timeout }).toString().trim() };
  } catch (e) {
    return { ok: false, out: "" };
  }
}

// A last-column header that OPTS THIS TABLE IN to command execution. Anchored
// on purpose: a substring test for "verif" would arm any table with a column
// named "Verified by" or "Verification owner", turning a roster into an
// execution list. Only these exact headers mean "this column holds commands".
const CLAIMS_HEADER_RE = /^(?:verify|verification|verify cmd|verify command|check|how to verify)$/i;

// Extract per-claim verify commands from the doc's markdown tables.
//
// Two guards decide what may run, because this is the only place a document's
// own text reaches a shell:
//   1. The caller passes MASKED lines, so a table inside a fenced code block
//      (an illustrative example, a quoted hostile doc) is invisible here.
//   2. The table must opt in via an exact last-column header (above).
// Within an opted-in row, the first backtick span of the last cell is the
// command; rows tagged [belief] or with n/a-style cells carry nothing to run.
function extractClaims(maskedLines) {
  const claims = [];
  const sep = /^\s*\|[\s:|-]+\|?\s*$/;
  let inVerifyTable = false;
  for (let i = 0; i < maskedLines.length; i++) {
    const line = maskedLines[i];
    if (!/^\s*\|/.test(line)) { inVerifyTable = false; continue; }
    if (sep.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (sep.test(maskedLines[i + 1] || "")) { // this row is a table header
      const last = (cells[cells.length - 1] || "").replace(/[`*_]/g, "").trim();
      inVerifyTable = CLAIMS_HEADER_RE.test(last);
      continue;
    }
    if (!inVerifyTable || cells.length < 2 || /\[belief/i.test(line)) continue;
    const m = (cells[cells.length - 1] || "").match(/`([^`]+)`/);
    if (!m) continue;
    const cmd = m[1].trim();
    if (/^(n\/a|-|—|none)$/i.test(cmd)) continue;
    claims.push({ line: i + 1, label: cells[0].replace(/[`*_]/g, "").trim().slice(0, 60), cmd });
    if (claims.length >= 25) break; // sanity cap; a handoff is not a test suite
  }
  return claims;
}

const src = fs.readFileSync(file, "utf8");
const r = evaluate(src);
const h = r.header || {};

// ---- VERIFICATION layer (repo-aware, best-effort) ---------------------------
const verification = { checks: [], inRepo: false, verdict: "unverified" };
const add = (name, status, detail) => verification.checks.push({ name, status, detail });

const inRepo = doRepo && git(["rev-parse", "--is-inside-work-tree"]).out === "true";
verification.inRepo = inRepo;

// iso_date sanity: a handoff can't have been true in the future. (Header
// validity already checked the YYYY-MM-DD shape.)
if (doRepo && h.iso_date && /^\d{4}-\d{2}-\d{2}$/.test(h.iso_date)) {
  const today = localISODate();
  if (h.iso_date > today) add("iso_date", "fail", `dated ${h.iso_date}, which is in the future (today is ${today})`);
  else add("iso_date", "ok", h.iso_date);
}

if (inRepo) {
  const sha = h.true_at_sha;
  // Defense in depth: never touch git with a value that isn't a bare SHA, even
  // though git() is already shell-free. A non-SHA here means the header is
  // malformed (validateHeader already flagged it); we just don't probe with it.
  if (sha && sha !== "uncommitted" && !/^[0-9a-f]{7,40}$/i.test(sha)) {
    add("true_at_sha", "fail", `true_at_sha "${sha}" is not a bare git SHA — cannot verify the freshness anchor`);
  } else if (sha && sha !== "uncommitted") {
    const exists = git(["cat-file", "-e", `${sha}^{commit}`]).ok;
    if (!exists) {
      add("true_at_sha", "fail", `commit ${sha} is not in this repo — the doc's freshness anchor is fabricated or from another repo`);
    } else {
      add("true_at_sha", "ok", `commit ${sha} exists`);
      const drift = git(["rev-list", "--count", `${sha}..HEAD`]);
      const n = drift.ok ? parseInt(drift.out, 10) || 0 : 0;
      if (n > 0) {
        const files = git(["diff", "--name-only", `${sha}..HEAD`]);
        const arr = files.ok && files.out ? files.out.split("\n") : [];
        const list = arr.length ? ` (changed: ${arr.slice(0, 8).join(", ")}${arr.length > 8 ? ", …" : ""})` : "";
        add("drift", "warn", `HEAD is ${n} commit(s) ahead of the true-at SHA — re-verify every claim before trusting${list}`);
      } else {
        add("drift", "ok", "HEAD is at the true-at SHA; nothing has drifted");
      }
    }
  } else if (sha === "uncommitted") {
    add("true_at_sha", "warn", 'true_at_sha is "uncommitted" — claims are pinned to a dirty tree that cannot be recovered; commit before handing off');
  }
}

// Per-claim verification (--claims): run each claim row's own check, so drift
// is localized to the specific claims that no longer hold instead of failing
// the whole doc as one blob. Exit-code contract: a claim's command must exit
// non-zero when the claim is violated (like a test), or its pass is meaningless.
if (runClaims && r.valid) {
  // Masked lines only: a table inside a fenced code block is an example, not an
  // instruction, and must never execute.
  const claims = extractClaims(maskBody(src.split(/\r?\n/)));
  if (!claims.length) {
    add("claims", "warn", "--claims was passed but no runnable claim rows were found (the claims table's last column header must be exactly Verify / Verification / Check, and must not be inside a code fence)");
  } else {
    let passed = 0;
    for (const c of claims) {
      const res = sh(c.cmd, 30000);
      if (res.ok) passed++;
      else add("claim", "fail", `L${c.line} "${c.label}" no longer holds — FAILED: ${c.cmd}`);
    }
    add("claims", passed === claims.length ? "ok" : "fail", `${passed}/${claims.length} claim checks hold`);
  }
}

// verify_cmd execution — the only thing that turns "done" from belief into fact.
// Skipped when the header is invalid: no reason to run an arbitrary command out
// of a doc that isn't even well-formed (the verdict is invalid-header anyway).
if (runVerify && h.verify_cmd && r.valid) {
  const res = sh(h.verify_cmd);
  add("verify_cmd", res.ok ? "ok" : "fail", res.ok ? `passed: ${h.verify_cmd}` : `FAILED: ${h.verify_cmd}`);
}
// A doc that declares itself done but never proves it is the classic silent-Done.
// This warning fires even in structure-only mode: the most likely cold-user path
// is a plain `handover-lint file.md`, and a "done" that was never proven must
// never scroll by silently.
if (h.status === "done") {
  const vc = verification.checks.find((c) => c.name === "verify_cmd");
  if (!runVerify) add("done-unproven", "warn", 'status is "done" but verify_cmd was not run here — re-run with --verify to prove it, or treat "done" as belief');
  else if (vc && vc.status === "fail") add("done-unproven", "fail", 'status is "done" but verify_cmd FAILED — this is not done');
}

// Verdict: fold the checks into one word.
const anyFail = verification.checks.some((c) => c.status === "fail");
const anyWarn = verification.checks.some((c) => c.status === "warn");
if (!r.valid) verification.verdict = "invalid-header";
else if (anyFail) verification.verdict = "failed";
else if (doRepo && !inRepo) verification.verdict = "unverified-no-repo"; // couldn't run the SHA/drift checks that matter
else if (anyWarn) verification.verdict = "stale-or-unproven";
else if (verification.checks.length) verification.verdict = "verified";
else verification.verdict = doRepo ? "structurally-valid-unverified" : "not-checked";

// ---- Output -----------------------------------------------------------------
if (asJson) {
  console.log(JSON.stringify({ file, ...r, verification }, null, 2));
} else {
  console.log(`\n${file}`);
  console.log(`  STRUCTURE:  ${r.score}/100   header: ${r.valid ? "valid" : "INVALID"}   (shape only — not proof of truth)`);
  const sub = r.subscores;
  console.log(`    header ${sub.header}/45  negative-knowledge ${sub.negative}/20  sections ${sub.sections}/15  self-containment ${sub.selfContainment}/12  prose ${sub.prose}/8`);
  if (r.headerErrors.length) {
    console.log("\n  header errors (gate-blocking):");
    for (const e of r.headerErrors) console.log(`    ✗ ${e.key}  ${e.msg}`);
  }
  if (r.injection.length) {
    console.log("\n  ⚠ injection risk (a cold agent may execute these):");
    for (const w of r.injection) console.log(`    ⚠ ${w.field}  ${w.msg}`);
  }
  if (r.prose.length) {
    console.log("\n  prose warnings (advisory):");
    for (const w of r.prose) console.log(`    • ${w.rule} L${w.line}  ${w.msg}`);
  }
  if (r.headerWarnings.length) {
    console.log("\n  header advisories:");
    for (const w of r.headerWarnings) console.log(`    • ${w.rule}  ${w.msg}`);
  }
  const s = r.structure;
  console.log("\n  structure:");
  console.log(`    negative knowledge: ${s.negativeKnowledge ? `present (${s.negCategories.join(", ")})` : "MISSING"}`);
  console.log(`    canonical sources:  ${s.canonicalSources ? "present" : "missing"}`);
  console.log(`    next action:        ${s.nextAction ? "present" : "missing"}`);
  console.log(`    verification:       ${s.verification ? "present" : "missing"}`);
  let vnote = "";
  if (!doRepo) vnote = "  [pass --repo to check the SHA/drift/date, --verify to also run verify_cmd]";
  else if (!inRepo) vnote = "  [not a git repo — repo checks skipped]";
  console.log(`\n  VERIFICATION (against repo): ${verification.verdict.toUpperCase()}${vnote}`);
  const glyph = { ok: "✓", warn: "⚠", fail: "✗" };
  for (const c of verification.checks) console.log(`    ${glyph[c.status] || "•"} ${c.name}: ${c.detail}`);
  console.log("");
}

let ok = r.valid;
if (min !== null && r.score < min) ok = false;
if (anyFail) ok = false; // a real failure (fabricated SHA, failed verify_cmd, future date) always fails
if (strict && anyWarn) ok = false; // under --strict, drift / unproven-done also fail
process.exit(ok ? 0 : 1);
