"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");

const STATE_DIR = path.join(os.homedir(), ".handover", "sessions");

function loadJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function loadPolicy(cwd) {
  let dir = cwd || process.cwd();
  for (let i = 0; i < 30; i++) {
    const pol = loadJSON(path.join(dir, ".handover", "policy.json"));
    if (pol) return pol;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return loadJSON(path.join(__dirname, "..", "policy.default.json")) || { version: 1, rules: [] };
}

// Which file the active policy came from, so `audit` can show whether the gate
// is running the bundled default or an in-repo override an agent could have
// written. Mirrors loadPolicy's search order exactly.
function findPolicyFile(cwd) {
  let dir = cwd || process.cwd();
  for (let i = 0; i < 30; i++) {
    const p = path.join(dir, ".handover", "policy.json");
    if (loadJSON(p)) return { path: p, source: "repo" };
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { path: path.join(__dirname, "..", "policy.default.json"), source: "default" };
}

function loadState(sessionId) {
  const safe = String(sessionId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  const file = path.join(STATE_DIR, safe + ".json");
  const data = loadJSON(file) || { counts: { allow: 0, ask: 0, deny: 0 }, denials: [], loop: {} };
  return { file, data };
}

const PRUNE_MARKER = path.join(STATE_DIR, ".last_prune");
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Session state files accumulate one-per-session forever otherwise. Throttled
// to roughly once a day via a marker file, since every hook call would
// otherwise pay a readdir+stat pass.
function pruneOldState() {
  try {
    const markerAge = Date.now() - fs.statSync(PRUNE_MARKER).mtimeMs;
    if (markerAge < PRUNE_INTERVAL_MS) return;
  } catch (e) {
    // no marker yet, proceed to prune
  }
  try {
    const now = Date.now();
    for (const f of fs.readdirSync(STATE_DIR)) {
      if (f.startsWith(".")) continue;
      const full = path.join(STATE_DIR, f);
      if (now - fs.statSync(full).mtimeMs > MAX_AGE_MS) fs.unlinkSync(full);
    }
    fs.writeFileSync(PRUNE_MARKER, String(now));
  } catch (e) {}
}

function saveState(state) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(state.file, JSON.stringify(state.data, null, 2));
    pruneOldState();
  } catch (e) {}
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "into", "this", "that", "true", "false",
  "null", "query", "command", "select", "insert", "update", "delete", "table",
  "where", "values", "limit", "order", "group", "https", "http", "echo"
]);

function extractTokens(s) {
  const out = new Set();
  for (const m of String(s).toLowerCase().matchAll(/[a-z_][a-z0-9_./-]{3,}/g)) {
    if (!STOPWORDS.has(m[0])) out.add(m[0]);
  }
  return out;
}

function significant(tokens) {
  return tokens.filter((t) => t.length >= 6 || /[_/.]/.test(t));
}

function readStdin(cb) {
  let raw = "";
  process.stdin.on("data", (d) => (raw += d));
  process.stdin.on("end", () => {
    let input = null;
    try {
      input = JSON.parse(raw);
    } catch (e) {}
    cb(input);
  });
}

module.exports = { STATE_DIR, loadJSON, loadPolicy, findPolicyFile, loadState, saveState, extractTokens, significant, readStdin };
