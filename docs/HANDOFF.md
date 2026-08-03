---
protocol_version: 1
handoff: handover-oss-readiness
author: Harshvardhan Pandey
iso_date: 2026-08-03
true_at_sha: 9f5db38287fc
shape: handoff
supersedes: null
first_action: Run ./test/run.sh from the repo root and confirm "37 passed, 0 failed" — that is the gate before any step in section 6.
verify_cmd: ./test/run.sh
status: in_progress
---

# Handover: Handover (0.4.0 — portability, per-claim verification, OSS readiness)

**Read this first. It is self-contained.** You should not need anything outside this file plus repo access to continue. It supersedes the 0.3.0 hardening handoff that used to live here.

## 0. Orientation (one paragraph)
Handover is an enforced agent-to-agent handover document — a strict validated header plus a prose body — with deterministic zero-dependency Node tooling: `handover-lint` scores a doc 0–100 and verifies it against the live repo, `handover-scaffold` fills the header from git, and `bench/run.js` measures whether a handoff actually transfers via planted traps. A separable behavioral gate ships alongside and is slated for extraction. Version 0.3.0 made the tooling check truth as well as shape. This work (0.4.0) was driven by a **cold-agent field test on an external repo** and an expert protocol review: it fixed the two real bugs that surfaced, added per-claim verification, tripled bench coverage, made the tooling usable outside Claude Code, and added the scaffolding an open-source release needs. This is the tree that was actually published, as a single squashed initial commit rather than a rewrite of private history. The repo went public on 2026-08-02 under Apache-2.0 and is tagged `v0.4.0`.

## 1. Identity (verify each; do not trust blindly)
| Fact | Value | Verify |
|---|---|---|
| Branch | `main` (this repo is a single squashed commit — no `dev`/feature branches here; those live in the private lab repo this was published from) | `git rev-parse --abbrev-ref HEAD` |
| True at commit | `9f5db38287fc` | `git log 9f5db38287fc..HEAD --oneline` (drift if non-empty) |
| Plugin version | `0.4.0` | `grep version .claude-plugin/plugin.json` |
| Protocol version | `1` (unchanged — 0.4.0 breaks no existing document) | `grep CURRENT_PROTOCOL_VERSION bin/lib/handover-doc.js` |
| Tests | 37 checks, 0 failures | `./test/run.sh` |

## 2. Current state as verifiable claims
| Claim | Verify |
|---|---|
| Full suite passes | `./test/run.sh` |
| Repo-verification suite passes (21 checks) | `bash test/verify.test.sh` |
| The git pre-commit hook suite passes, including fail-open | `bash test/hook.test.sh` |
| Three bench scenarios exist, not one | `ls bench/scenarios` |
| `--claims` cannot execute a table inside a code fence | `grep -n maskBody bin/handover-lint.js` |
| No internal-only doc paths are referenced by shipping files | `! grep -riqE 'IP_EVALUATION\|docs/RELEASE' README.md PROTOCOL.md CHANGELOG.md docs/ARCHIVE.md` |
| The plugin cache still holds an older build until reinstalled | `[belief, unverified]` — nothing here updates `~/.claude/plugins/cache/handover` |

## 3. Canonical sources (ranked; when they disagree, higher wins; code is truth)
1. This file, for status and the next action.
2. [README.md](README.md) (the docs router), for topic → authoritative doc → code path.
3. [PORTING.md](PORTING.md) for non-Claude-Code use.
4. [PROTOCOL.md](../PROTOCOL.md) for the format and rubric; [SECURITY.md](SECURITY.md) for the threat model; [STALENESS.md](STALENESS.md) for the enforcement roadmap.
5. The tests, for the contract the code actually meets.

(Some pre-publish planning docs referenced in earlier drafts were internal working
files and are deliberately not part of this public tree.)

## 4. What changed in 0.4.0 (do not rebuild these)
- Per-claim verification (`--claims`) is **built** — it was item 2 on the STALENESS roadmap. Do not re-implement it.
- Bench scenarios went from 1 to 3, and `bench/README.md` now states the authoring rule. Do not add a scenario by deriving its `guard_pattern` from an existing good artifact.
- `package.json`, CI, CONTRIBUTING, root SECURITY, CODE_OF_CONDUCT, and issue templates exist. Do not re-create them.
- The README install command was fixed (it pointed at a legacy local path). Do not restore the old path.
- Released and launched (2026-08-03): public since 2026-08-02, tagged `v0.4.0`, submitted to the Claude Code plugin marketplace, paper published, and six issues opened from the STALENESS roadmap. Do not re-tag or re-announce.

## 5. Negative knowledge (the irreducible core — if you must cut length, cut this last)
- **Tried and failed:** the first cut of `--claims` extracted commands from **raw** document lines and armed any table whose last column merely *contained* "verif". Adversarial review proved two working command-execution escapes (a table inside a code fence; a "Verified By" roster column). The working approach is fence-**masked** lines plus an **exact** header match. Do not loosen either guard, and do not add a second parser that reads raw document text — that is how both holes appeared. Full write-up: SECURITY.md finding 4.
- **Tried and failed (0.3.0, still true):** building `--repo` git calls by string-interpolating `true_at_sha` into a shell command — a command-injection hole. All git probes stay shell-free via `execFileSync`.
- **Deliberately out of scope / not built:** the empirical bench runner (an agent-in-the-loop layer would put an LLM in an enforcement path — the contract is documented in `bench/README.md` and left pluggable on purpose); drift-to-claim mapping; negative-knowledge expiry; PR/ticket liveness; provenance/signing. All are on the STALENESS roadmap, not forgotten.
- **Built then reverted, do NOT re-add:** a broad `curl|wget … | anything` injection regex (flagged benign `curl | jq`; only a pipe into a shell/interpreter is flagged now). Also do not make repo verification default-on — it produces false failures when the doc belongs to another repo, which is exactly the bundled example's case.
- **Decisions + rationale:** the core validator (`handover-doc.js`) stays pure and deterministic so tests assert exact numbers and the gate can reuse it; anything touching the repo or a shell lives in the CLI. `--claims` implies `--verify` because both are the same trust decision, and splitting them would imply a safety difference that does not exist. The git pre-commit hook deliberately does **not** pass `--verify`/`--claims`: a commit hook must never execute commands out of the document being committed.

## 6. Next action
1. **Run `./test/run.sh` and confirm `37 passed, 0 failed`** (mirror of the header `first_action`). This is the gate before anything below.
2. Work the open issues at https://github.com/geekidharsh/handover/issues, which are the STALENESS roadmap made visible. The highest-leverage one is still the hand-off-time verify gate (ranked first under "enforcement we should add" in [STALENESS.md](STALENESS.md)): as of 2026-08-03 verification is opt-in, and a `PreToolUse`/commit hook that refuses to publish a `status: done` handoff without a fresh passing `--verify` turns "should verify" into "did verify."
3. Reinstall the plugin cache to pick up 0.4.0.
4. When the arXiv ID is announced, update the citation block in `README.md` and `CITATION.cff` with the real identifier and the announced primary category.

## 7. Open questions / blocked on user
- Should the behavioral gate be extracted to its own repo, so this one is cleanly just the document? Deferred so far; the README's Scope section currently explains the split instead.

## 8. Verify the whole thing still holds
```
./test/run.sh
```
