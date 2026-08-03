#!/usr/bin/env node
"use strict";
const { loadPolicy, loadState, saveState, extractTokens, significant, readStdin } = require("./lib.js");

// Workspace edits are user-reviewable in the diff, so they skip the
// route-around check; Bash, MCP tools, and Task (a subagent could be used
// to launder a denied action) do not. Known gap: an agent could still write
// a script file and execute it — documented in README limitations.
const ROUTE_EXEMPT = new Set([
  "Read", "Grep", "Glob", "LS", "NotebookRead", "TodoWrite", "AskUserQuestion",
  "Edit", "Write", "MultiEdit", "NotebookEdit", "WebSearch"
]);

function ruleMatches(rule, input) {
  const m = rule.match || {};
  try {
    if (m.tool && !new RegExp(m.tool).test(input.tool_name || "")) return false;
    if (m.command) {
      const cmd = input.tool_input && input.tool_input.command;
      if (typeof cmd !== "string" || !new RegExp(m.command, "i").test(cmd)) return false;
    }
    if (m.input && !new RegExp(m.input, "i").test(JSON.stringify(input.tool_input || {}))) return false;
  } catch (e) {
    return false;
  }
  return true;
}

function out(decision, reason) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      permissionDecisionReason: reason
    }
  };
}

function decide(input) {
  const policy = loadPolicy(input.cwd);
  const state = loadState(input.session_id);
  if (input.cwd) state.data.cwd = input.cwd; // let `audit` resolve which policy governed this session
  const rule = (policy.rules || []).find((r) => ruleMatches(r, input)) || null;
  const action = rule ? rule.action : "passthrough";

  if (action === "allow") {
    state.data.counts.allow++;
    saveState(state);
    return out("allow", `Handover: ${rule.name || "read"}, auto-approved read-class action`);
  }

  if (!ROUTE_EXEMPT.has(input.tool_name)) {
    const cur = extractTokens(JSON.stringify(input.tool_input || {}));
    for (const d of state.data.denials) {
      const sig = d.tokens || [];
      const shared = sig.filter((t) => cur.has(t));
      if (sig.length >= 2 && shared.length >= 2 && shared.length * 2 >= sig.length) {
        state.data.counts.deny++;
        saveState(state);
        return out(
          "deny",
          `Handover: this looks like a retry of an action already denied this session via ${d.tool} (matched: ${shared
            .slice(0, 4)
            .join(", ")}). Do not reroute around a denial. Tell the user what you were trying to do and why, and let them decide.`
        );
      }
    }
  }

  if (action === "ask") {
    state.data.counts.ask++;
    saveState(state);
    return out("ask", `Handover: ${(rule && (rule.reason || rule.name)) || "write-class action"}, needs your approval`);
  }

  if (action === "deny") {
    const tokens = significant([...extractTokens(JSON.stringify(input.tool_input || {}))]).slice(0, 40);
    state.data.counts.deny++;
    state.data.denials.push({ tool: input.tool_name, rule: (rule && rule.name) || "", tokens, ts: Date.now() });
    if (state.data.denials.length > 20) state.data.denials.shift();
    saveState(state);
    return out("deny", (rule && rule.reason) || "Handover: denied by policy. Hand this action back to the user.");
  }

  return null;
}

readStdin((input) => {
  if (!input) return process.exit(0);
  let result = null;
  try {
    result = decide(input);
  } catch (e) {}
  if (result) process.stdout.write(JSON.stringify(result));
  process.exit(0);
});
