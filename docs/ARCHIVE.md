# Handover — archived design history

This is the archived / historical design discussion for Handover. The canonical, current definition of the product is [`../README.md`](../README.md), with the document format specified in [`../PROTOCOL.md`](../PROTOCOL.md) — when this file and those disagree, they win. Nothing here overrides the current definition; it preserves the framing and rationale earlier drafts carried in the README so no design context is lost in the re-scope.

## The re-scope, in one line

Handover was first described as three co-equal modules. It is now **one thing**: an enforced, agent-to-agent handover document (the format + the rules + the bench that keep it honest). The behavioral **gate** was demoted from a co-equal module to a *separate concern* being tried independently. This file records what that framing used to say.

## The original "three modules" framing (superseded)

The earlier README opened:

> Trust infrastructure for coding agents, shipped as a Claude Code plugin. Three deterministic modules: a **format** agents hand work off in, a **gate** that keeps their behavior honest, and a **bench** that measures whether a handoff actually transferred.

- **Module 1 — Protocol (the format).** Retained, and now central. It is the handover document itself: strict validated header + human prose body. See [`../PROTOCOL.md`](../PROTOCOL.md) and the [README](../README.md).
- **Module 3 — Bench (the scale).** Retained. The empirical measure of whether a handoff transfers (trap coverage). Now framed as part of the one product's tooling in the [README](../README.md).
- **Module 2 — Gate (the cop).** *Demoted.* No longer co-equal; it is a separable behavioral concern, preserved below.

## Why it existed — the second (behavioral) failure

The original "why this exists" argued from two concrete failures. The first — lost transfer / missing negative knowledge — motivates the handover document and stayed in the [README](../README.md). The second motivated the behavioral gate and is archived here:

> **Untrustworthy behavior.** The built-in permission prompt has no memory (a denied action reroutes through another tool) and no self-awareness (nothing notices an agent re-resolving the same conflict six times).

The launch narrative behind that failure (all true, from [`PLAN.md`](PLAN.md)): an agent audited a branch 288 commits behind trunk so most findings were already fixed; an agent re-resolved the identical squash-merge conflict on six branches in a row, silently, until the user asked why it was taking so long; and a user wrote a standing rule for all agent tooling — read freely, mutate never, no rerouting around a "no" — because it is enforceable without judgment calls.

## The behavioral gate (a separate concern)

Preserved verbatim from the former README "Module 2 — Gate" section. This governs *any* agent action, not the handover document. Its home is a separate **trust layer for AI agents** — agents run end-to-end between org-declared checkpoints (merge, deploy, send, migrate), every action logged, with production-grade actions gated behind a *named human's* passkey clearance and a signed attestation ("agents run the work, humans move the milestones"). Within it, this gate is the automatic in-session **Allow/Ask** floor beneath the human **Attest** checkpoint — the smallest piece already built in code, and slated for extraction from this repo. It ships here unnamed; the product is defined by what it does, above. Deterministic hooks, all fail-open:

| Piece | What it does |
|---|---|
| **Mutation gate** (PreToolUse) | An ordered JSON policy classifies every call `allow` / `ask` / `deny` / `passthrough`. Reads auto-approve, writes ask, destructive ops (force-push, hard reset, recursive delete on `/` or `~`, DROP/TRUNCATE/unscoped DELETE) are denied and handed back. |
| **Sticky denials** | Each denial is fingerprinted; a later call through *any* tool (including `Task`) that reroutes the same action is denied again. A "no" sticks. |
| **Loop detector** (PostToolUse) | Fingerprints real failures by tool, target, and error signature; interrupts on the second identical one. Scans only outcome fields (`stdout`/`stderr`/`error`), never echoed file content, and **clears a fingerprint on success** — so a successful edit near the word "conflict" is not mistaken for a repeated failure. |
| **Policy self-edit guard** | The gate's own policy is editable by the agent it governs, so an edit to `.handover/policy.json` (via `Write`/`Edit` or shell redirection) is forced to `ask`, and `audit` reports whether the active policy is the trusted default or an in-repo override — and if the latter, whether it's committed (reviewable) or an uncommitted change. A self-neutered gate becomes visible. |
| **Handover header gate** (PostToolUse) | A `Write`/`Edit` landing a `HANDOVER_*.md` with a malformed header is blocked, with the exact fields to fix. Header-only; prose stays advisory. `status: done` is refused unless a `verify_cmd` is present. |

Note: the **Handover header gate** row above is the exception — it enforces the *handover document* and remains core to the product (it is summarized in the current [README](../README.md) under "The document"). The other four rows are the separable behavioral concern.

### Per-project policy (gate configuration)

Preserved from the former README "Per-project policy" section. Drop a `.handover/policy.json` in your repo root (Handover walks up from the working directory; otherwise the bundled default applies). A project policy fully replaces the default, so copy the defaults in and layer yours on top. First match wins. See [`../examples/example-project.policy.json`](../examples/example-project.policy.json). Because policy is a file in the repo, guardrails are code-reviewed like everything else.

### What the gate deliberately does *not* do

Preserved from the former README "what it deliberately does not do" section (the gate-specific boundaries):

- **The mutation gate is regex over command strings, not a sandbox.** Variable indirection (`g=push; git $g -f`), `eval`, aliases, base64, or writing a script and executing it can slip past. It raises the cost of a mistake; it is not containment. Run agents with real OS/permission boundaries too.
- **Command-string matching over-triggers on prose.** Because the gate inspects Bash command strings, a `git commit` whose *message* contains a destructive example can trip a destructive-pattern rule. Observed live.

The full threat model for the gate is in [`SECURITY.md`](SECURITY.md).

## Design-decision rationale

The shape of the bet, the origin stories, the rollout phases, the self-review pass that found three real bugs, and the honest competitive read all live in [`PLAN.md`](PLAN.md) (written 2026-07-08). The key deliberate scope calls recorded there: everything stays deterministic (LLM-judged safety kills the trust story); no telemetry / accounts / hosted anything (readable in ten minutes, trusted in one); baseline and stale-build checkers deferred as project-specific policy-pack extensions, not core.

## Further archived detail

Nothing was deleted in the re-scope — these historical docs remain, and each is authoritative for its topic:

- [`PLAN.md`](PLAN.md) — the product plan: the wedge, origin narrative, MVP, rollout phases, competitive read, risks.
- [`STALENESS.md`](STALENESS.md) — what goes stale in a handover artifact and the ranked enforcement roadmap.
- [`HANDOFF.md`](HANDOFF.md) — the repo's own live handoff document (dogfood; scores 100/100).
- [`SECURITY.md`](SECURITY.md) — threat model, 0.3.0 review findings, residual risk.
- [`README.md`](README.md) — the docs router (topic → authoritative doc → code).

For the current, canonical definition, always start from [`../README.md`](../README.md).
