#!/usr/bin/env node
"use strict";
const { loadState, saveState, readStdin } = require("./lib.js");

const FAIL_RE = /(error|failed|failure|fatal|conflict|exception|permission denied|enoent|eacces)/gi;
const NEGATION_RE = /\b(no|0|zero|without)\s*$/i;

// Only these fields of a tool_response carry outcome signal. We deliberately do
// NOT scan the whole response: Edit/Write echo the edited file's content and
// surrounding diff context, so a *successful* edit to a file that merely
// contains words like "conflict" or "failure" (e.g. this very repo) would read
// as a repeated failure. Scanning outcome fields only is the fix for that
// false positive, observed live while dogfooding.
const OUTCOME_FIELDS = ["stdout", "stderr", "error", "message", "reason"];

function outcomeText(resp) {
  if (resp == null) return "";
  if (typeof resp === "string") return resp; // generic tool success/error string
  const parts = [];
  for (const k of OUTCOME_FIELDS) if (typeof resp[k] === "string") parts.push(resp[k]);
  // Explicit error flag with no textual field: fall back to the whole object.
  const flagged = resp.is_error === true || resp.error === true;
  if (!parts.length && flagged) return JSON.stringify(resp);
  return parts.join("\n");
}

function findFailure(str) {
  FAIL_RE.lastIndex = 0;
  let m;
  while ((m = FAIL_RE.exec(str))) {
    const before = str.slice(Math.max(0, m.index - 12), m.index);
    if (!NEGATION_RE.test(before)) return m;
  }
  return null;
}

function target(input) {
  const ti = input.tool_input || {};
  return (
    ti.file_path ||
    ti.path ||
    ti.notebook_path ||
    (typeof ti.command === "string" ? ti.command.trim().split(/\s+/).slice(0, 2).join(" ") : "") ||
    ""
  );
}

function fingerprint(input, respStr, m) {
  const start = Math.max(0, m.index - 40);
  const sig = respStr
    .slice(start, m.index + 60)
    .toLowerCase()
    .replace(/[0-9a-f]{7,}/g, "#")
    .replace(/\d+/g, "#")
    .replace(/[^a-z#_/. :-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return [input.tool_name, target(input), sig].join(" | ");
}

readStdin((input) => {
  if (!input) return process.exit(0);
  let result = null;
  try {
    const respStr = outcomeText(input.tool_response);
    const m = findFailure(respStr);
    const state = loadState(input.session_id);
    if (!state.data.loop) state.data.loop = {}; // tolerate a state file predating the loop key
    if (m) {
      const fp = fingerprint(input, respStr, m);
      const n = (state.data.loop[fp] || 0) + 1;
      state.data.loop[fp] = n;
      saveState(state);
      if (n >= 2) {
        const tgt = fp.split(" | ")[1];
        result = {
          decision: "block",
          reason: `Handover loop detector: this is occurrence #${n} of the same failure (${input.tool_name}${
            tgt ? " on " + tgt : ""
          }). Stop before retrying the same approach. Tell the user what pattern is repeating, why it repeats, and how many more repeats you expect. Ask whether to batch the fix, reorder the work, or stop.`
        };
      }
    } else {
      // Success on this (tool, target): clear any accumulated loop for it, so a
      // failure that gets resolved doesn't leave a live count that a later,
      // unrelated success-then-failure would push straight to "occurrence #2".
      const prefix = `${input.tool_name} | ${target(input)} | `;
      let changed = false;
      for (const key of Object.keys(state.data.loop)) {
        if (key.startsWith(prefix)) { delete state.data.loop[key]; changed = true; }
      }
      if (changed) saveState(state);
    }
  } catch (e) {}
  if (result) process.stdout.write(JSON.stringify(result));
  process.exit(0);
});
