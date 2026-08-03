#!/usr/bin/env node
"use strict";
// PostToolUse hard gate on Handover documents. When a Write/Edit lands a file
// named like a Handover doc, validate the resulting YAML header. A malformed
// header blocks with the exact fields to fix. Header-only (deterministic, safe
// to gate); prose issues are left to `handover-lint` (advisory). Fail-open.
const fs = require("fs");
const path = require("path");
const { readStdin } = require("./lib.js");
const { validateHeader, parseHeader } = require("../bin/lib/handover-doc.js");

const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit"]);
const NAME_RE = /^(?:HANDOVER|HANDOFF)_.*\.md$|\.handover\.md$/i;

readStdin((input) => {
  if (!input) return process.exit(0);
  let result = null;
  try {
    const ti = input.tool_input || {};
    const fp = ti.file_path || ti.path || "";
    if (EDIT_TOOLS.has(input.tool_name) && fp && NAME_RE.test(path.basename(fp))) {
      const src = fs.readFileSync(fp, "utf8");
      const { header } = parseHeader(src);
      const errors = validateHeader(header);
      if (errors.length) {
        const lines = errors.map((e) => `  - ${e.msg}`).join("\n");
        result = {
          decision: "block",
          reason:
            `Handover gate: ${path.basename(fp)} has an invalid header, so it is not a trustworthy handoff yet.\n${lines}\n` +
            `Fix the header (see PROTOCOL.md, or run: node bin/handover-scaffold.js). A Handover is never "done" on belief — only on a passing verify_cmd.`
        };
      }
    }
  } catch (e) {}
  if (result) process.stdout.write(JSON.stringify(result));
  process.exit(0);
});
