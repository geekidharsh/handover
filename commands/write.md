---
description: Generate a protocol-compliant Handover document from live git state, ready to fill in
allowed-tools: Bash(node:*), Bash(git:*), Bash(gh:*)
---

Scaffold a Handover document for the current workstream. The header facts (branch, commit SHA, open PR, tickets) are read from live repo state by the scaffold script, so they are true, not remembered:

!`node "${CLAUDE_PLUGIN_ROOT}/bin/handover-scaffold.js" ${1:+--workstream="$1"}`

Now complete it, following these rules from PROTOCOL.md:

1. Write the file to a deterministic path: `Docs/HANDOVER_<WORKSTREAM>_<ISO-DATE>.md` (or the repo's docs convention).
2. Replace every `FILL IN`. The header's `first_action` and `verify_cmd` are load-bearing — `first_action` must be the single unambiguous next step, and `verify_cmd` must be a real command that proves the current state.
3. Spend the most effort on §5 (negative knowledge): what was tried and failed, what is deliberately out of scope, what was reverted and must not be re-added, and the decisions with their rationale. This is the part a successor cannot re-derive from the code.
4. Every state claim in §2 carries its own verify command, or is tagged `[belief, unverified]`.
5. Do not set `status: done` unless `verify_cmd` actually passes.

After writing, lint it and report the score to the user:

!`echo "Run after writing: node \"${CLAUDE_PLUGIN_ROOT}/bin/handover-lint.js\" <path>"`
