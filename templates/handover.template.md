---
protocol_version: 1
handoff: <workstream-slug>
author: <who wrote this — a name a receiver can go ask>
iso_date: 2026-01-01
true_at_sha: <commit SHA these claims were true at, or "uncommitted">
shape: handoff
supersedes: null
first_action: <the single unambiguous next step>
verify_cmd: <a command that proves the state below still holds>
status: in_progress
---

# Handover: <workstream>

**Read this first. It is self-contained.** You should not need anything outside this file plus repo access to continue this work.

## 0. Orientation (one paragraph)
<What this workstream is, in plain language.>

## 1. Identity (verify each; do not trust blindly)
| Fact | Value | Verify |
|---|---|---|
| Branch | `<branch>` | `git rev-parse --abbrev-ref HEAD` |
| True at commit | `<sha>` | `git log <sha>..HEAD --oneline` (empty = nothing drifted) |
| Open PR | `<url or none>` | `gh pr view` |
| Worktree? | `<yes/no>` | n/a |
| Tickets | `<ids>` | `grep -n 'In progress' TASKS.md` |

## 2. Current state as verifiable claims
| Claim | Verify |
|---|---|
| `<what you believe is true>` | `<command>` or `[belief, unverified]` |

## 3. Canonical sources (ranked; when they disagree, higher wins; code is truth)
1. `<this file>`
2. `<next authority>` — `<note if partly stale>`

## 4. What changed since the last canonical doc (do not rebuild these)
- `<delta the successor would otherwise re-derive or undo>`

## 5. Negative knowledge (the irreducible core — if you must cut length, cut this last)
- **Tried and failed:** `<what + why it failed>`
- **Deliberately out of scope / not built:** `<what, and why not now>`
- **Built then reverted, do NOT re-add:** `<what + the reason it was pulled>`
- **Decisions + rationale:** `<decision → why>`

## 6. Next action
1. **`<the one first step — must match first_action in the header>`**
2. `<the ordered rest>`

## 7. Open questions / blocked on user
- `<question the successor cannot resolve alone>`

## 8. Verify the whole thing still holds
```
<the command from verify_cmd>
```
