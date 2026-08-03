# Docs router

Topic → the one authoritative doc → the code that implements it. A cold agent
should find the right source in a single read instead of ranking entry points.
(This router is the repo-level cross-topic pointer that HANDOVER §H6/H9 doesn't
cover — H6/H9 point within a workstream, this points across topics.)

| If you want to know… | Read | Implemented in | Last updated |
|---|---|---|---|
| What Handover is, how to install, trust posture | [../README.md](../README.md) | — | 2026-07-11 |
| The handoff format + the 0–100 rubric + STRUCTURE vs VERIFICATION | [../PROTOCOL.md](../PROTOCOL.md) | `bin/lib/handover-doc.js`, `bin/handover-lint.js` | 2026-07-11 |
| Archived design history (three-module framing, the behavioral gate, lineage) | [ARCHIVE.md](ARCHIVE.md) | — | 2026-07-14 |
| Current status + the actual next steps (the live handoff) | [HANDOFF.md](HANDOFF.md) | — | 2026-07-11 |
| What can go stale + the enforcement roadmap | [STALENESS.md](STALENESS.md) | `bin/handover-lint.js` (`--repo`/`--verify`) | 2026-07-11 |
| Threat model, review findings, residual risk | [SECURITY.md](SECURITY.md) | `hooks/gate.js`, `bin/handover-lint.js`, `hooks/audit.js` | 2026-07-11 |
| Everything that changed, by version | [../CHANGELOG.md](../CHANGELOG.md) | — | 2026-08-01 |
| Bench scenarios: how to author one, the empirical-runner contract | [../bench/README.md](../bench/README.md) | `bench/run.js` | 2026-08-01 |
| How to contribute + the four non-negotiable invariants | [../CONTRIBUTING.md](../CONTRIBUTING.md) | — | 2026-08-01 |
| Using Handover outside Claude Code (other harnesses, git hook, CI) | [PORTING.md](PORTING.md) | `hooks/pre-commit.sample`, `bin/*.js` | 2026-08-01 |

## Code map

| Area | Files |
|---|---|
| Document validator (pure, deterministic — the STRUCTURE score) | `bin/lib/handover-doc.js` |
| Lint CLI (STRUCTURE + repo VERIFICATION) | `bin/handover-lint.js` |
| Scaffold (fills header from live git/gh) | `bin/handover-scaffold.js` |
| Mutation gate + sticky denials | `hooks/gate.js`, `hooks/lib.js`, `policy.default.json` |
| Loop detector | `hooks/loop.js` |
| Header gate (PostToolUse) | `hooks/handover-gate.js` |
| Audit (session + policy provenance) | `hooks/audit.js` |
| Bench (lint + trap coverage) | `bench/run.js`, `bench/scenarios/*` |
| Slash commands | `commands/{write,lint,audit}.md` |
| Tests | `test/run.sh`, `test/doc.test.js`, `test/verify.test.sh`, `test/*.json` |

When docs disagree, the one named above for a topic wins; code is truth.
