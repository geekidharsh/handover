# The Lossless Handoff Protocol

**A content contract for agent-to-agent context handoff and task delegation.**
Portable across repos. Handover (this repo) is the enforcement layer; this file is the spec it enforces.
This specifies the format of *the* handover document — the single agent-to-agent artifact Handover is built around. (Handover also ships a separable behavioral gate; that is a distinct concern and is not specified here.)

---

## 0. The one invariant everything serves

> A handoff is **lossless** iff a cold agent — given only the artifact plus repo access, and *nothing* from chat history — can reach the same decisions the sender would. It is **seamless** iff the receiver's first action is unambiguous.

Every rule below exists to protect that sentence. When a rule seems expensive, ask: does skipping it force the receiver to re-derive a decision or a dead end? If yes, keep it.

---

## 1. Three interaction shapes — do not conflate them

| Shape | When | Artifact | Lifetime |
|---|---|---|---|
| **Delegation** | Parent hands a bounded task to a child subagent that returns a result | **Task envelope** (§5) | Ephemeral |
| **Handoff** | A session hands a whole workstream to a cold successor | **Handoff doc** (§3–§4) | Durable |
| **Broadcast** | Shared canonical facts many agents read | **Single source of truth** with supersession discipline (H6) | Durable |

Most loss comes from using a delegation envelope where a handoff doc was needed (successor starves) or a handoff doc where an envelope was needed (child drowns in irrelevant context and returns the wrong shape).

---

## 2. The two load-bearing ideas

### 2a. Every assertion is a *claim*, not a *fact*
A handoff records what the sender *believed* was true at a moment. Belief drifts from reality (code moves, PRs merge). Therefore **every state claim MUST carry either (a) a one-line command to verify it, or (b) an explicit `[belief, unverified]` tag.** The receiver trusts nothing that carries neither. This is the single highest-leverage rule — it converts a stale doc from a landmine into a checklist.

### 2b. Negative knowledge is the irreducible core
Positive state (what exists) is re-derivable by reading code. **Negative knowledge is not** — you cannot read the codebase to learn what was tried and abandoned, what was deliberately left unbuilt, or what was reverted and must not return. So preserve it in priority order, and **if forced to cut length, cut positive state before negative knowledge:**

1. **Tried-and-failed** (what + why it failed) → prevents retry loops (the failure loop).
2. **Deliberately out-of-scope / not built** → prevents scope creep.
3. **Built-then-reverted, do-not-re-add** (+ the reason) → prevents undo/redo thrash.
4. **Decisions + rationale** → prevents re-litigation.

---

## 3. The handoff document contract — required sections (all MUST be present)

0. **Orientation** — one paragraph: what this is, self-contained.
1. **Identity block** — repo, branch, latest commit SHA, open PR (URL), worktree?, ticket ids — *each with its verify command*.
2. **Current state as verifiable claims** — a table; every row carries a verify command or `[belief]` tag (2a).
3. **Canonical sources, ranked** — with the tie-break rule ("when docs disagree, higher wins; code is truth; X is stale where noted").
4. **What changed since the last canonical doc was written** — the deltas / do-not-rebuild list.
5. **Negative knowledge** — the four categories of §2b.
6. **Next action** — exactly one first step marked as *the* first step, then the ordered rest.
7. **Open questions / blocked-on-user.**
8. **Whole-artifact verification** — the compile/test command that proves the state still holds.

---

## 4. Hard rules (MUST / MUST NOT — each is testable, so each is lint-able / gate-checkable)

- **H1 — Self-containment.** No reference to "chat history," "as we discussed," "you'll remember." If it's load-bearing, it's *in* the doc.
- **H2 — Claims carry checks.** Every state claim has a verify command or a `[belief, unverified]` tag (2a).
- **H3 — Absolute dates only.** ISO dates, never "yesterday," "recently," "last session."
- **H4 — Addressable references.** File path, PR **URL**, commit **SHA**, ticket **id** — never a bare name or bare `#123`.
- **H5 — One first action.** Exactly one step is marked as *the* first thing to do. Ambiguity here is the #1 seamlessness failure.
- **H6 — Explicit supersession.** When a doc goes stale, the *newer* doc names it and says what's stale. Never two live docs silently disagreeing. Each workstream has one top-of-file pointer: "read THIS first."
- **H7 — Freshness stamp.** Record the commit SHA the doc was true at, so the receiver computes drift with `git log <sha>..HEAD` before trusting anything.
- **H8 — No silent Done.** Status stays In-progress until its verify command passes. Never mark Done on belief.
- **H9 — Deterministic location + name.** Durable handoffs live at a predictable path so agents *find* them unprompted: `Docs/HANDOFF_<WORKSTREAM>_<ISO>.md`, plus a stable per-workstream pointer that always names the current authoritative one.

---

## 5. The delegation envelope (subagent case) — required fields

A subagent starts cold and re-derives nothing you already know. The envelope MUST carry:

- **Goal** — one testable sentence.
- **Context pointers** — the *few* files/URLs it needs, not the whole world.
- **Constraints + don't-touch list** — what it must not modify or assume.
- **Definition of done** — the observable condition that ends the task.
- **Return shape** — exactly what to hand back (the final message is the only thing the parent sees).
- **Escalation rule** — when to stop and ask vs. decide autonomously.

Keep it minimal on purpose: a delegation drowns on too much context, a handoff starves on too little. Opposite failure modes.

---

## 6. How this marries the gate (built)

This protocol is the *content* contract; the Handover gate is the *deterministic backstop*. It is built:

- `bin/handover-lint.js` scores any doc 0–100 and exit-codes on header validity (`bin/lib/handover-doc.js` is the shared validator).
- `hooks/handover-gate.js` (PostToolUse) hard-blocks a `Write`/`Edit` to a `HANDOVER_*.md` whose header is invalid, naming the exact fields to fix. Header-only, because that half is deterministic and safe to gate; prose stays advisory (see §6a).
- `bin/handover-scaffold.js` fills the header from live git/gh state, so machine facts are read, not remembered.

That turns the load-bearing MUSTs (H2 claims-carry-checks via the header, H5 one first action, H7 freshness SHA, H8 no silent Done) from aspiration into a checked gate — the same way the mutation gate turns "don't force-push" into a refusal.

## 6b. The two layers `handover-lint` reports

The tool separates **shape** from **truth**, because they have different trust
values and only one of them can be judged from the text alone.

### STRUCTURE — the deterministic 0–100 rubric (always on)

Pure text analysis. Same input, same score. It proves a doc is *built to be
checkable* — never that a claim is *true*. Weighted toward what §2b says matters:

- **Header validity — 45 pts.** The seven required fields, each present and well-formed. Placeholders (`FILL IN`, `<…>`, `TBD/TODO/???`), malformed SHAs/dates, bad enums, and an unknown `protocol_version` all fail. This is what the gate hard-blocks on.
- **Negative knowledge — 20 pts.** 5 per §2b category (tried-and-failed, out-of-scope, reverted, decisions). A category counts only when it appears on its own line with real content beyond the label — so keyword-stuffing and left-in scaffold placeholders earn nothing. The irreducible core, scored on substance.
- **Section completeness — 15 pts.** Canonical sources, a marked next action, and a verification section — each detected only on a *structural* line (heading or list item), so a keyword buried in a paragraph can't claim a section it lacks.
- **Self-containment — 12 pts.** Minus 6 per distinct H1 violation (chat-history reliance, negation-aware) or injection flag. The protocol's #1 rule, weighted so two violations can sink a score.
- **Prose cleanliness — 8 pts.** Minus 2 per distinct H3/H4 nit (relative dates, bare `#123`), floored at 0. Cosmetic, never gate-blocking, because prose scanning false-positives (§6a).

Two optional header fields are recognized and validated if present: `protocol_version` (which protocol contract the doc targets) and `author` (who a receiver can go ask). Their absence is an advisory, not a failure.

### VERIFICATION — repo-aware truth checks (opt-in)

Structure can't know if `true_at_sha` is real or if `status: done` is earned.
These checks can, but only inside the doc's *own* repo, so they're opt-in:

- `--repo` (read-only): confirms `true_at_sha` exists in the repo (a fabricated or foreign anchor **fails**), computes drift with `git rev-list <sha>..HEAD` (**warns**, listing changed files, so a stale doc reads as stale), and flags a future `iso_date`.
- `--verify`: everything `--repo` does, plus runs `verify_cmd`. This is the only thing that turns `status: done` from belief into fact.
- `--claims` (implies `--verify`): additionally runs **each claim row's own verify command** and reports the specific claims that no longer hold, localizing drift instead of failing the doc as one blob. A table opts in to execution only by naming its last column exactly `Verify`, `Verification`, or `Check` — a "Verified By" column is a roster and is never run — and only outside fenced code blocks, so an example table in a doc (or a hostile doc quoted inside one) cannot execute. Rows tagged `[belief…]` are skipped.

**Execution contract** (for `verify_cmd` and claim commands): commands run through the user's shell, in the current working directory (run the lint from the repo root), with a 120s timeout for `verify_cmd` and 30s per claim. The only signal read is the **exit code** — write every check like a test, exiting non-zero when the claim is violated (`test -f`, `grep -q`, `npm test`), because a command that exits 0 regardless (`git log`, a bare `ls`) passes vacuously.

Verdict folds into one word: `verified` / `stale-or-unproven` / `failed` / `unverified-no-repo` / `invalid-header`. A fabricated SHA, future date, or failed `verify_cmd` exits non-zero; drift/unproven-done exits non-zero under `--strict`. All repo probes run **without a shell**, so a hostile doc's header can never execute — the only document text that reaches a shell is `verify_cmd` (under `--verify`) and opted-in claim rows (under `--claims`).

---

## 6a. The universal handout: structured header + prose body (validated 2026-07-09)

A prototype validator run against real handoff docs showed prose-only rules have a ~30% false-positive rate: a doc that *asserts* "don't rely on chat history" trips the same regex as one that *violates* it, and a doc that quotes banned phrases as examples flags itself. Conclusion: **prose alone is not machine-checkable enough to gate on.**

So the universal handout is a hybrid, and this is the template every durable handoff should follow:

```
---                          # structured header — tooling validates this STRICTLY (0 false positives)
protocol_version: 1          # which protocol contract this doc targets (optional, validated)
handoff: <workstream>
author: <who wrote this>     # a name a receiver can go ask (optional)
iso_date: 2026-07-09
true_at_sha: <commit SHA the claims below were true at>
shape: handoff | delegation | broadcast
supersedes: <path-or-null>
first_action: <the one unambiguous next step>
verify_cmd: <command that proves the state still holds>
status: in_progress | done   # 'done' only allowed if verify_cmd passes
---

<prose body follows the §3 section contract — linted LOOSELY: skip fenced code
blocks and blockquotes, and be negation-aware, so example/quote text isn't flagged>
```

The header carries exactly the facts that must never be lost or ambiguous (freshness SHA, the one first action, supersession, the verify command). Tooling checks their *presence and shape* deterministically. The prose stays human. This is the deliverable to standardize on.

## 7. The 10-second test for any handoff before you ship it

> Delete the chat. Hand a stranger only this file and a terminal. Can they take the correct next action, avoid every dead end you already hit, and never rebuild something you deliberately removed? If any answer is no, the missing piece belongs in §2b, §4, or §6.
