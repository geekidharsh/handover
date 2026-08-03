<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/geekidharsh/handover/main/assets/brand/handover-mark-dark-128.png">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/geekidharsh/handover/main/assets/brand/handover-mark-light-128.png">
  <img alt="Handover" src="https://raw.githubusercontent.com/geekidharsh/handover/main/assets/brand/handover-mark-light-128.png" width="56" height="56">
</picture>

# Handover

Claude Code, Cursor, and Codex forget everything between sessions. The next agent inherits a session summary nobody checked, re-derives what you already knew, and rebuilds what you deliberately threw away.

Handover is an **agent-to-agent handover document** with a header a machine can verify, plus deterministic tooling: a linter that scores it and checks it against the live repo, and a trap-based benchmark that measures whether the handoff actually transferred. The document, and the rules that keep it honest, *are* the product.

No LLM in any enforcement path. No network. No telemetry. Zero dependencies (plain Node, which Claude Code already requires).

## Why this exists

Agents forget everything between sessions, and nobody checks their handoff notes. A session ends, the next agent inherits a summary that says "see discussion above." There is no above. The reasons and the dead ends went out with the context window, so the successor re-derives what it can and rebuilds what it shouldn't.

A better summary doesn't fix this. What goes missing is the part you can't recover by reading the code: approaches that were tried and failed, things deliberately not built, changes that were reverted and must not come back. Handover makes that the load-bearing part of the document, and every claim in it carries its own check.

### Why not just CLAUDE.md or AGENTS.md?

Different jobs, and they compose rather than compete. `CLAUDE.md` and `AGENTS.md` are **standing context**: durable rules and project shape that are true every session, hand-maintained, read at startup. A Handover is **a transfer**: point-in-time state for one workstream, written at a session boundary, consumed once, then superseded.

The operational difference is that a Handover is checkable and a context file isn't. It is anchored to a commit (`true_at_sha`), so drift since is measurable instead of assumed. It carries a `verify_cmd`, so `status: done` can be refused until that command actually passes. Nothing in `AGENTS.md` can go stale loudly, because nothing in it makes a falsifiable claim about repository state. That is the gap this fills. Keep your context files; this is the thing that hands off the work.

## Try it in a minute

As a Claude Code plugin:

```
/plugin marketplace add geekidharsh/handover
/plugin install handover@handover
```

Exit and restart Claude Code (hooks only load at session start). Then work normally: any `HANDOVER_*.md` you save is checked for a valid header, `/handover:write` scaffolds a compliant handoff from live git state, `/handover:lint` scores one, `/handover:audit` reports what happened, and `node bench/run.js` measures whether an artifact transfers. The plugin also ships a **behavioral gate** (reads auto-approve, writes ask, destructive ops refused, repeated failures interrupt) — a separable concern, not part of the handover document; see [Scope](#scope).

### Or use the CLI directly — any repo, any harness

The document, lint, scaffold, and bench are plain Node (≥18) with zero dependencies; only the hooks and slash commands are Claude Code-specific. From any git repo:

```
node <handover>/bin/handover-scaffold.js > Docs/HANDOVER_myfeature_2026-08-01.md   # header pre-filled from live git/gh state
node <handover>/bin/handover-lint.js Docs/HANDOVER_myfeature_2026-08-01.md          # structure score (0-100)
node <handover>/bin/handover-lint.js <doc> --repo                                   # + does true_at_sha exist, how far has HEAD drifted
node <handover>/bin/handover-lint.js <doc> --verify --claims --strict               # + run verify_cmd and every claim's own check
```

(`npm install -g` the checkout and the same tools are on your PATH as `handover-lint` / `handover-scaffold`.) For enforcement without any harness integration, install the git hook — it validates any staged `HANDOVER_*.md` and fails open if Handover isn't present:

```
cp hooks/pre-commit.sample .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

Adopting Handover in another harness (Cursor, Aider, Codex CLI, your own runner) is documented in [docs/PORTING.md](docs/PORTING.md).

## The document

[`PROTOCOL.md`](PROTOCOL.md) is the full spec. A Handover document is a hybrid: a **strict YAML header** tooling validates deterministically, plus a **human prose body**. The header carries the facts that must never be lost or ambiguous — the commit SHA the claims were true at, the one unambiguous first action, the command that verifies the state, and whether it supersedes an earlier doc.

Two load-bearing ideas:

- **Every claim carries its own check.** A handoff records belief, and belief drifts from reality. So each state claim ships a verify command or an explicit `[belief, unverified]` tag. Verify, don't trust.
- **Negative knowledge is the irreducible core.** Anything that exists can be re-read from the code. The abandoned approach, the feature cut on purpose, the change someone already reverted: none of that is anywhere in the diff. If you have to cut length, cut positive state first.

The header is **gated**: a `Write`/`Edit` landing a `HANDOVER_*.md` with a malformed header is blocked, with the exact fields to fix, and `status: done` is refused unless a `verify_cmd` is present. Header-only; prose stays advisory. `/handover:write` scaffolds a compliant doc, filling the header from live `git`/`gh` state so the machine facts are read, not remembered. See [`templates/handover.template.md`](templates/handover.template.md) and a worked [`examples/handover.example.md`](examples/handover.example.md) (scores 100/100).

## Lint and bench — keep it honest, measure the transfer

The tooling that makes the document more than a convention:

- **Lint** ([`bin/handover-lint.js`](bin/handover-lint.js)) scores any doc 0–100 (rubric in `PROTOCOL.md` §6b), separating the always-on **STRUCTURE** score (built-to-be-checkable) from the opt-in repo-aware **VERIFICATION** pass (`--repo`/`--verify`, checked against the real repo). `--claims` goes further: it runs *each claim row's own verify command*, so drift is localized to the specific claims that no longer hold.
- **Bench** ([`bench/run.js`](bench/run.js)) is the part nobody else has: an empirical measure of whether a handoff transfers. Each scenario plants traps (a reverted change that invites re-adding, a tried-and-failed path, an ambiguous next step) and reports **trap coverage** — for each trap, does the artifact carry the negative knowledge that steers a cold agent away from it? Three scenarios ship today (`reverted-feature`, `failed-dependency-upgrade`, `descoped-admin-export`); authoring rules and the pluggable empirical-runner contract are in [`bench/README.md`](bench/README.md).

```
$ node bench/run.js   # excerpt — one of three scenarios
=== scenario: reverted-feature (3 planted traps) ===
  artifact          lint     valid  traps covered  quality
  good.handover.md  100/100  yes    3/3            100/100
  bad.handover.md   16/100   NO     0/3            8/100
  (no artifact)     0/100    NO     0/3            0/100
  delta (good - bad): +92 quality points; trap coverage 3/3 vs 0/3.
```

## Scope

Handover ships a **behavioral gate** in this same repo — a mutation gate (reads allow / writes ask / destructive deny), sticky cross-tool denials, and a loop detector. This is a **separate concern**: it governs *any* agent action, not the handover document. Its real home is a separate **agent clearance / permissions layer** — the automatic per-action floor that runs beneath a human checkpoint (the "human-at-the-gate" model). It is slated for extraction there; it happens to ship here for now and is not part of the handover-document definition. Its design history, the full gate table, and the per-project `.handover/policy.json` mechanics live in [docs/ARCHIVE.md](docs/ARCHIVE.md).

> **Naming note.** The gate belongs to that separate clearance product and will carry that product's name once extracted; until then it ships here unnamed. Once the gate is extracted, this repo is cleanly *just* the handover document.

## Lineage

Handover began as the agent-to-agent wire format inside a broader exploration of human↔agent session continuity. The two concerns stayed distinct on purpose: a *ledger* tracks one project's truth over time between a human and their agents; a *handover* transfers a workstream across an agent boundary, cold. This repo is only the second thing. Fuller design history in [docs/ARCHIVE.md](docs/ARCHIVE.md).

## Trust posture

- **Deterministic.** Regex, token counts, and a flat header parser. No model decides what is a valid handoff.
- **Shape is not truth.** `handover-lint` separates the always-on **STRUCTURE** score from the opt-in **VERIFICATION** pass (`--repo`/`--verify`, checked against the real repo). A high score never means "true" — only `--verify` running the doc's `verify_cmd` does. Repo probes run shell-free, so an untrusted doc can't execute; only your own `verify_cmd` runs, and only when you ask.
- **Local.** No network, no telemetry. Session state lives in `~/.handover/sessions/`.
- **Auditable.** Small Node scripts, zero dependencies. Read them in fifteen minutes.
- **Fail-open.** If a hook crashes or a policy is malformed, Handover emits nothing and Claude Code's normal permissions remain in effect. It raises the floor. Don't rely on it as your only line of defense.

### What it deliberately does *not* do

Where the score lies to you:

- **STRUCTURE scores shape.** A determined author can write four plausible negative-knowledge lines that are false. Only the VERIFICATION pass (and a human reading the prose) judges truth.
- **`--verify` runs the doc's `verify_cmd` through a shell**, and `--claims` runs its per-claim commands. That is intended (same trust as `make test`), so pass them only on a handoff you trust to author those commands. Nothing else in a document ever reaches a shell.
- **No provenance/signing yet.** `author` is a self-declared field, not an authenticated identity. A hostile upstream doc's *negative knowledge* (e.g. a planted "do not re-add X") is the most dangerous thing to fabricate and is not yet cryptographically attributable.

(The behavioral gate's own limits — regex is not a sandbox, and command-string matching can over-trigger on prose — are documented with the gate in [docs/ARCHIVE.md](docs/ARCHIVE.md) and [docs/SECURITY.md](docs/SECURITY.md).)

## Test

```
./test/run.sh
```

37 top-level checks — including three bundled sub-suites (`test/doc.test.js`, 39 pure-core assertions; `test/verify.test.sh`, 21 repo-aware checks against a throwaway git repo; `test/hook.test.sh`, 4 checks on the harness-independent git hook, including that it fails *open*). Coverage: the STRUCTURE rubric (placeholder/gaming/injection/H1-weighting/masking/determinism), the VERIFICATION layer (fabricated SHA, drift, future date, `verify_cmd` pass/fail, non-git degrade, and a command-injection canary), the Handover header gate, and — for the separable gate — allow/ask/deny classification, route-around detection (including via `Task`), loop escalation with the false-positive fix, and policy self-edit gating.

## Status

**0.4.0 (portability + per-claim verification).** The handover document, its lint, and its bench are built and hardened; the behavioral gate ships alongside as a separable concern (see [Scope](#scope)). A trust-and-abuse review reweighted the rubric to score substance over shape, added the repo-aware `--repo`/`--verify` layer, policy tamper-evidence, and fixed a command-injection bug found in review. 37 test checks pass. The repo's own handoff ([docs/HANDOFF.md](docs/HANDOFF.md)) scores 100/100 and passes `--verify` against this repo, so the tool eats its own dog food. It also demonstrates the limit honestly: because committing the handoff moves `HEAD`, a doc can never anchor to a commit that contains itself, so `--repo` always reports one commit of drift whose only changed file is the handoff. Reporting drift that invalidated nothing is exactly the gap tracked in [issue #3](https://github.com/geekidharsh/handover/issues/3). It has also been exercised end-to-end on an external repo by a cold agent (scaffold → fill → lint `--repo`/`--verify`, plus deliberate attacks: fabricated SHA, unproven `done`, placeholders — all caught; two real bugs that run surfaced, a UTC-vs-local date drift and a too-quiet unproven `done`, are fixed with regression tests). Full history in [CHANGELOG.md](CHANGELOG.md); threat model in [docs/SECURITY.md](docs/SECURITY.md); archived design history in [docs/ARCHIVE.md](docs/ARCHIVE.md); what's next in [docs/STALENESS.md](docs/STALENESS.md). Public since 2026-08-02 under Apache-2.0; the hand-off-time verify gate is the next step.

## Open questions

The unfinished edges are tracked as [issues](https://github.com/geekidharsh/handover/issues), and the interesting ones are unfinished on purpose rather than merely unstarted:

- **[Drift is reported, not localized.](https://github.com/geekidharsh/handover/issues/3)** A 40-commit drift that touched none of a claim's files has not actually invalidated that claim. Inferring which files a claim depends on is the unsolved part, and getting it wrong makes the tool confidently wrong.
- **[Negative knowledge never expires.](https://github.com/geekidharsh/handover/issues/2)** "Do not re-add X" is correct until the reason stops applying, and nothing tells you that day arrived. The one row in [docs/STALENESS.md](docs/STALENESS.md)'s table with nothing in the "caught by" column.
- **[Does the pilot hold at another model tier?](https://github.com/geekidharsh/handover/issues/6)** One of three planted traps discriminated at n=1. Either the other two are weak traps or the model was strong enough not to need help; the data cannot tell you which. Negative results wanted.

Smaller, well-scoped starting points: [add a bench scenario](https://github.com/geekidharsh/handover/issues/1) (one directory, no core changes), [flag dead doc links](https://github.com/geekidharsh/handover/issues/4) (no network at all), or [port the write-time gate](https://github.com/geekidharsh/handover/issues/5) to Cursor, Aider, or your own runner. [CONTRIBUTING.md](CONTRIBUTING.md) has the four invariants any change has to hold.

## License

Apache-2.0.
