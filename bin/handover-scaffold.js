#!/usr/bin/env node
"use strict";
// Handover scaffold: emit a pre-filled Handover document from LIVE git/gh state,
// so the machine facts in the header are read, never remembered.
// Usage: node bin/handover-scaffold.js [--workstream="name"] [--shape=handoff] [--dir=Docs]
// Prints the scaffolded markdown to stdout. Deterministic given repo state.
const { execSync } = require("child_process");

function sh(cmd, fallback = "") {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"], timeout: 15000 }).toString().trim();
  } catch (e) {
    return fallback;
  }
}

const args = process.argv.slice(2);
const arg = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split("=").slice(1).join("=") : d;
};

const branch = sh("git rev-parse --abbrev-ref HEAD", "unknown");
const dirty = sh("git status --porcelain") !== "";
const sha = sh("git rev-parse HEAD", "").slice(0, 12) || "uncommitted";
const trueAtSha = dirty || !sha ? "uncommitted" : sha;
const { localISODate } = require("./lib/handover-doc.js");
const isoDate = localISODate();
// Author is read from git config so a receiver knows who to ask — a machine
// fact, not a remembered one. Falls back to a placeholder the gate will flag.
const author = sh("git config user.name", "") || "FILL IN — who wrote this";
const inWorktree = sh("git rev-parse --is-inside-work-tree") === "true" && /\.worktrees\//.test(sh("git rev-parse --git-dir"));

// Best-effort open PR for this branch (needs gh; silently degrades).
const prJson = sh(`gh pr view --json number,url,state 2>/dev/null`, "");
let prLine = "no open PR found (verify with: gh pr view)";
try {
  const pr = JSON.parse(prJson);
  if (pr && pr.url) prLine = `[#${pr.number}](${pr.url}) — ${pr.state}`;
} catch (e) {}

// Best-effort in-progress ticket ids from a TASKS.md, if one exists.
const tickets = sh(`grep -hoE '[A-Z]{2,}(-[A-Z]+)?-[0-9]+' TASKS.md 2>/dev/null | sort -u | head -6 | paste -sd', ' -`, "");

const workstream = arg("workstream", branch.replace(/[^a-zA-Z0-9]+/g, "-"));
const shape = arg("shape", "handoff");

const doc = `---
protocol_version: 1
handoff: ${workstream}
author: ${author}
iso_date: ${isoDate}
true_at_sha: ${trueAtSha}
shape: ${shape}
supersedes: null
first_action: FILL IN — the single unambiguous next step
verify_cmd: FILL IN — a command that proves the state below still holds
status: in_progress
${shape === "delegation" ? "suggested_model: FILL IN — e.g. claude-haiku-4-5 (cheap) .. claude-fable-5 (hardest)\nsuggested_effort: FILL IN — low | medium | high | xhigh\n" : ""}---

# Handover: ${workstream}

**Read this first. It is self-contained.** You should not need anything outside this file and repo access to continue.

## 0. Orientation (one paragraph)
FILL IN — what this workstream is, in plain language.

## 1. Identity (verify each; do not trust blindly)
| Fact | Value | Verify |
|---|---|---|
| Branch | \`${branch}\` | \`git rev-parse --abbrev-ref HEAD\` |
| True at commit | \`${trueAtSha}\` | \`git log ${trueAtSha}..HEAD --oneline\` (should be empty) |
| Open PR | ${prLine} | \`gh pr view\` |
| Worktree? | ${inWorktree ? "yes — do all git via CLI, not the IDE" : "no"} | n/a |
| Tickets | ${tickets || "FILL IN"} | \`grep -n 'In progress' TASKS.md\` |

## 2. Current state as verifiable claims
FILL IN — each row a claim + its check, or tag \`[belief, unverified]\`.

## 3. Canonical sources (ranked; when they disagree, higher wins; code is truth)
FILL IN.

## 4. What changed since the last canonical doc (do not rebuild these)
FILL IN.

## 5. Negative knowledge (the irreducible core — cut this last)
- **Tried and failed:** FILL IN (what + why it failed).
- **Deliberately out of scope / not built:** FILL IN.
- **Built then reverted, do NOT re-add:** FILL IN (+ reason).
- **Decisions + rationale:** FILL IN.

## 6. Next action
1. **FILL IN — the one first step (mirror this into \`first_action\` above).**
2. FILL IN — the ordered rest.

## 7. Open questions / blocked on user
FILL IN.

## 8. Verify the whole thing still holds
\`\`\`
${arg("verify_hint", "# the command from verify_cmd above")}
\`\`\`

<!-- Scaffolded with Handover (https://github.com/geekidharsh/handover) — an enforced agent-to-agent handoff protocol. -->
`;

process.stdout.write(doc);
