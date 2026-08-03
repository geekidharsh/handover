---
description: Summarize what Handover allowed, asked, denied, and flagged in the most recent session
allowed-tools: Bash(node:*)
---

Handover session audit output:

!`node "${CLAUDE_PLUGIN_ROOT}/hooks/audit.js"`

Relay this to the user in plain language: how many reads were auto-approved (permission prompts saved), what asked for approval, what was denied and under which rule, and any repeating-failure patterns the loop detector caught. If there were denials or loop flags, briefly say what the user might want to do about them. Do not re-run or retry any denied action.
