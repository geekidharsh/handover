# Changelog

All notable changes to Handover. Dates are ISO-8601. This project targets
Handover protocol `protocol_version: 1`.

## [0.4.0] — 2026-08-01 — Portability, per-claim verification, open-source readiness

Driven by a cold-agent field test on an external repo (the first time the tooling was
run by someone who only had the README) plus an expert protocol review. Two real bugs
from that run are fixed; the bench grew from one scenario to three; the repo gained the
scaffolding an open-source release needs.

### Fixed
- **Date drift across timezones.** Scaffold and lint derived "today" from
  `new Date().toISOString().slice(0,10)` — the UTC date. After ~17:00 US-Pacific that is
  already tomorrow, so a scaffold stamped a future-looking `iso_date` and the future-date
  check ran a day ahead of wall-clock. Both now use a shared `localISODate()`
  (`bin/lib/handover-doc.js`), with a regression test that compares it to `date +%F`
  under two extreme timezones.
- **An unproven `done` was too quiet.** `handover-lint doc.md` with no flags — the most
  likely cold-user invocation — exited 0 on a `status: done` doc without ever mentioning
  that `verify_cmd` had not been run. The `done-unproven` warning now fires in
  structure-only mode too.
- **Scaffold ticket detection was hard-coded to one project's ticket prefix.** Now matches
  generic `ABC-123` / `ABC-DEF-123` ids.
- **Security: `maskBody()` didn't track fence length, so `--claims` could execute a table
  nested in a mismatched-length fence** (a 4-backtick outer fence around a 3-backtick
  inner one) that every Markdown renderer, including GitHub, still shows as one inert
  example. Found in a follow-up security review before this branch was proposed for
  merge. Fixed by giving `maskBody()` real CommonMark-style fence tracking (same
  character, closer length >= opener's) instead of a boolean toggle on any ` ``` ` line.
  Regression: the `claimsnested.md` canary in `test/verify.test.sh`. Full write-up:
  `docs/SECURITY.md` finding 5.

### Added
- **`--claims`** (implies `--verify`): runs *each claim row's own verify command* and
  names the specific rows that no longer hold, localizing drift instead of failing the
  whole document. Was item 2 on the STALENESS roadmap. Because this is the second place a
  document's own text can reach a shell, execution is doubly gated: the table must opt in
  with an **exact** last-column header (`Verify` / `Verification` / `Check` — "Verified
  By" is a roster, not a command list), and extraction runs on **fence-masked** lines so a
  table inside a code block is an example, never an instruction. `[belief]`-tagged rows are
  skipped. Both gates were added after an adversarial review of the first implementation
  proved arbitrary execution through a fenced example table and through a "Verified By"
  column; each has a canary regression test.
- **Harness-independent enforcement:** `hooks/pre-commit.sample`, a git pre-commit hook
  that validates any staged `HANDOVER_*.md` / `*.handover.md` in any repo with any agent
  (or none). Fails **open** when Handover is not installed, and never executes anything
  out of the document being committed. `docs/PORTING.md` covers adoption in other
  harnesses (Cursor, Aider, Codex CLI, CI) — previously the repo assumed Claude Code.
- **Execution contract documented** (`PROTOCOL.md` §6b): commands run through the shell
  from the current working directory, 120s for `verify_cmd` / 30s per claim, and only the
  exit code is read — so a check that exits 0 regardless passes vacuously.
- **Two new bench scenarios**, tripling trap coverage: `failed-dependency-upgrade` (a
  pinned dependency whose upgrade already failed, a load-bearing file that looks dead, a
  first step that must precede a misleading error) and `descoped-admin-export` (a
  deliberately-descoped feature, a settled library decision inviting re-litigation, a
  reverted client cache). Plus `bench/README.md` documenting the scenario-authoring rule
  (**traps are authored from an observed failure first, never derived from the good
  artifact's wording**) and the pluggable empirical-runner contract.
- **Open-source scaffolding:** `package.json` (npm/npx, `bin` entries, Node ≥18), CI
  across Linux/macOS × Node 18/20/22, `CONTRIBUTING.md` (with the four non-negotiable
  invariants), root `SECURITY.md`, `CODE_OF_CONDUCT.md`, and issue templates.

### Changed
- README: the install command pointed at a legacy local path on the author's machine; it
  now points at the public repo. Added a **CLI-direct** section (scaffold/lint usage from
  any repo, any harness) — previously the raw invocation appeared only inside an internal
  status doc, so a non-Claude-Code user had no documented path.
- Tests: 21 checks in `test/verify.test.sh` (was 13), a new `test/hook.test.sh` (4 checks
  incl. the fail-open case), 37 top-level.

## [Unreleased]

- **Docs re-scope (no code change).** README rewritten around a single identity — an enforced, agent-to-agent handover document (format + lint + bench) — with the behavioral gate (mutation gate / sticky denials / loop detector) demoted from a co-equal module to a separable "Scope" concern. Added a lineage note (Handover originated from the ContextOps exploration as its agent-to-agent wire format). Stripped framing and rationale moved to new `docs/ARCHIVE.md` (linked from README and the docs router); no content discarded.
- **Gate home identified (no code change).** The behavioral gate is recorded as the in-session runtime layer of a separate **agent clearance / permissions layer** (the "human-at-the-gate" model), slated for extraction from this repo. It ships here unnamed until that extraction; no rename performed.

## [0.3.0] — 2026-07-11 — Hardening

A trust-and-abuse review of 0.2.0 found that the tooling checked a handoff's
*shape* but never its *truth*, and that several enforcement points were
self-referential (an agent could game the score or disable its own gate). This
release closes those gaps. No breaking changes to the protocol; the document
format is unchanged and old docs still validate.

### Added
- **Repo-aware verification layer** in `handover-lint` (`bin/handover-lint.js`):
  - `--repo` (read-only): confirms `true_at_sha` exists in the repo, computes
    drift with `git rev-list <sha>..HEAD` (lists changed files), flags a future
    `iso_date`.
  - `--verify`: everything `--repo` does, plus runs `verify_cmd` — the only
    thing that turns `status: done` from belief into fact. `--run-verify` kept
    as an alias.
  - `--strict`: drift / unproven-done also exit non-zero.
  - Output now separates **STRUCTURE** (the deterministic score) from
    **VERIFICATION** (the repo checks) with a one-word verdict.
- **Optional header fields** `protocol_version` and `author`, validated when
  present; their absence is an advisory, not a failure. Scaffold fills `author`
  from `git config user.name`.
- **`first_action` injection detection**: a shell/download-exec pattern in the
  field a cold agent is told to run first is flagged and docks the score
  (advisory, never gate-blocking).
- **Policy self-edit guard**: edits to `.handover/policy.json` /
  `policy.default.json` (via `Write`/`Edit` or shell) are forced to `ask`; the
  gate records `cwd`, and `audit` reports whether the active policy is the
  trusted default or an in-repo override, and whether that override is committed.
- **Test suites**: `test/doc.test.js` (39 pure-core assertions) and
  `test/verify.test.sh` (13 repo-aware checks against a throwaway git repo,
  including a command-injection canary). `test/run.sh` grew policy-edit and
  audit checks and wires both suites in — 36 top-level checks total.
- **Docs**: `docs/STALENESS.md` (staleness surface + enforcement roadmap),
  `docs/SECURITY.md` (threat model, review findings, residual limits), this
  changelog.

### Changed
- **Rubric reweighted** to 45/20/15/12/8 (`bin/lib/handover-doc.js`), and every
  component made harder to game:
  - Negative knowledge (20) scored per §2b category, each requiring its own line
    with real content past the label — keyword-stuffing and left-in scaffold
    placeholders earn nothing.
  - Section completeness (15) requires the cue on a *structural* line (heading or
    list item), not buried inline.
  - Self-containment (H1) is now its own 12-pt bucket (−6/hit) so the protocol's
    #1 rule can sink a score; H3/H4 stay cosmetic (8 pt).
  - Header validity (45) rejects `<…>`, `TBD`, `TODO`, `???` placeholders in
    required fields, not just `FILL IN`.
- `PROTOCOL.md` §6b rewritten around the STRUCTURE-vs-VERIFICATION split.
- `README.md` gained a "what it deliberately does not do" section (regex is not
  a sandbox; shape is not truth; `--verify` runs the doc's own command; no
  provenance yet).

### Fixed
- **Security (introduced and fixed within this release):** the verification
  layer built git commands by string-interpolating `true_at_sha` and ran even
  for an invalid header, so a hostile doc with a command-substitution anchor
  executed during `lint --repo`. All git probes now run shell-free
  (`execFileSync` argv) in both `handover-lint.js` and `hooks/audit.js`, with a
  bare-SHA guard as defense in depth. The only shell path left is the doc's own
  `verify_cmd` under `--verify`, and it is skipped for an invalid header.
- Two lint false positives: an `author: Name <email>` no longer reads as a
  template placeholder; the injection matcher no longer trips on a benign
  `curl | jq` (only a pipe into a shell/interpreter counts).
- `destructive-fs` deny now also catches `rm -rf ${HOME}`.

### Known limitations (unchanged, now documented)
- The mutation gate is regex over command strings, not a sandbox: variable
  indirection, `eval`, aliases, base64, or write-then-execute can slip past.
- The gate matches Bash command strings including `git commit` messages, so
  example text in a commit message can trigger a destructive-pattern rule.
- No provenance/signing: `author` is self-declared, not authenticated.

## [0.2.0] — 2026-07-09

Initial three-module build (Protocol, Gate, Bench) as a Claude Code plugin;
renamed from an earlier working title.
