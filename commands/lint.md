---
description: Score a Handover document 0-100 against the protocol (deterministic, no LLM)
allowed-tools: Bash(node:*)
---

Lint the Handover document at the given path and report the result:

!`node "${CLAUDE_PLUGIN_ROOT}/bin/handover-lint.js" "$1"`

Relay to the user: the score, whether the header is valid (header errors are gate-blocking — the file will be blocked on save until fixed), any advisory prose warnings, and whether the negative-knowledge section is present. If the header is invalid, list exactly which fields to fix. Do not edit the file unless asked.
