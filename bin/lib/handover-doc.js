"use strict";
// Shared validator core for a Handover document.
// One source of truth, used by both bin/handover-lint.js (scoring CLI) and
// hooks/handover-gate.js (the PostToolUse hard gate on the header).
// Zero dependencies. Deterministic: same input -> same findings and score.
//
// Scope boundary (important): this module judges the *shape* of a document from
// its text alone. It is pure and repo-independent, so it can never confirm a
// claim is *true* — only that the doc is structured to be checkable. The
// repo-aware "is this actually true right now" pass (SHA exists, drift, running
// verify_cmd) lives in bin/handover-lint.js and is deliberately kept separate.

const CURRENT_PROTOCOL_VERSION = "1";

// Today's date in the machine's LOCAL timezone, as YYYY-MM-DD. Never use the
// UTC slice of toISOString() for "today": after ~17:00 US-Pacific it is already
// tomorrow in UTC, so a scaffold would stamp a future-looking date and the
// future-date check would drift a day ahead of wall-clock.
function localISODate(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const KNOWN_PROTOCOL_VERSIONS = new Set(["1"]);
const REQUIRED_KEYS = ["handoff", "iso_date", "true_at_sha", "shape", "first_action", "verify_cmd", "status"];
const SHAPES = new Set(["handoff", "delegation", "broadcast"]);
const STATUSES = new Set(["in_progress", "done"]);
const EFFORTS = new Set(["low", "medium", "high", "xhigh"]);

// A value that is still a scaffold stand-in, not a real answer. Covers the
// scaffold's own "FILL IN", angle-bracket template slots (<...>), and the usual
// human placeholders. Kept strict so a half-filled doc can't pass as done.
// The angle-bracket arm excludes '@' so a real "Name <email@host>" author isn't
// mistaken for a template slot like "<the next step>".
const PLACEHOLDER_RE = /FILL IN|<[^>@]*>|\b(?:TBD|TODO|XXX|FIXME|N\/A)\b|\?\?\?/i;

function firstMatch(s, re) {
  const m = String(s).match(re);
  return m ? m[0].trim().slice(0, 60) : "";
}

// Parse a leading YAML-ish front-matter block: flat `key: value` lines between
// the first two `---` fences. We intentionally support only the flat subset the
// protocol defines, so there is no YAML dependency and no ambiguity.
function parseHeader(src) {
  const lines = src.split(/\r?\n/);
  if (lines[0].trim() !== "---") return { header: null, headerEndLine: 0 };
  const header = {};
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") return { header, headerEndLine: i + 1 };
    const mt = lines[i].match(/^([a-z_][a-z0-9_]*)\s*:\s*(.*)$/i);
    if (mt) {
      let v = mt[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      header[mt[1]] = v;
    }
  }
  return { header: null, headerEndLine: 0 }; // never closed
}

// Header validation. Returns a list of {rule, key, msg} errors (empty = valid).
// These are the deterministic, gate-grade checks — safe to hard-block on.
function validateHeader(header) {
  const errors = [];
  const err = (key, msg) => errors.push({ rule: "header", key, msg });
  if (!header) {
    err("_", "no YAML header found (a Handover file must open with a --- front-matter block)");
    return errors;
  }
  for (const k of REQUIRED_KEYS) {
    const v = String(header[k] == null ? "" : header[k]).trim();
    if (!(k in header) || v === "") err(k, `missing or empty required field: ${k}`);
    else if (PLACEHOLDER_RE.test(v)) err(k, `${k} still has a scaffold placeholder (${firstMatch(v, PLACEHOLDER_RE)}) — fill it in`);
  }
  if (header.iso_date && !/^\d{4}-\d{2}-\d{2}$/.test(header.iso_date))
    err("iso_date", `iso_date must be YYYY-MM-DD, got "${header.iso_date}"`);
  if (header.true_at_sha && !/^[0-9a-f]{7,40}$/i.test(header.true_at_sha) && header.true_at_sha !== "uncommitted")
    err("true_at_sha", `true_at_sha must be a 7-40 char git SHA (or "uncommitted"), got "${header.true_at_sha}"`);
  if (header.shape && !SHAPES.has(header.shape))
    err("shape", `shape must be one of ${[...SHAPES].join(", ")}, got "${header.shape}"`);
  if (header.status && !STATUSES.has(header.status))
    err("status", `status must be one of ${[...STATUSES].join(", ")}, got "${header.status}"`);
  // The load-bearing rule: no silent Done.
  if (header.status === "done" && (!header.verify_cmd || String(header.verify_cmd).trim() === ""))
    err("status", 'status is "done" but verify_cmd is empty — a Handover is never done on belief, only on a passing check');
  if (header.suggested_effort && !EFFORTS.has(header.suggested_effort))
    err("suggested_effort", `suggested_effort must be one of ${[...EFFORTS].join(", ")}, got "${header.suggested_effort}"`);
  // Optional, but validated when present.
  if (header.protocol_version && !KNOWN_PROTOCOL_VERSIONS.has(String(header.protocol_version)))
    err("protocol_version", `protocol_version "${header.protocol_version}" is not known to this tool (supported: ${[...KNOWN_PROTOCOL_VERSIONS].join(", ")})`);
  if ("author" in header && String(header.author).trim() === "")
    err("author", "author is present but empty — name who wrote this handoff, or remove the field");
  return errors;
}

// Non-blocking header advisories: worth a nudge, must not fail the gate (so old
// docs keep working and fail-open holds).
function headerAdvisories(header) {
  const warns = [];
  if (!header) return warns;
  if (!("protocol_version" in header))
    warns.push({ rule: "PV", msg: `no protocol_version — add "protocol_version: ${CURRENT_PROTOCOL_VERSION}" so a future reader knows which contract this doc targets` });
  if (!("author" in header))
    warns.push({ rule: "AU", msg: "no author — a receiver can't tell who to ask; add an author field" });
  else if (PLACEHOLDER_RE.test(String(header.author)))
    warns.push({ rule: "AU", msg: `author is still a placeholder (${firstMatch(String(header.author), PLACEHOLDER_RE)}) — put a real name a receiver can go ask` });
  return warns;
}

// Split the prose body into lines while masking fenced code blocks and
// blockquotes, so example/quoted text can't trip the prose linters. Masked
// lines become "" (kept for line-number fidelity). This is the fix for the
// ~30% false-positive rate the prose-only prototype showed.
//
// Fence tracking follows CommonMark: a fence closes only on a delimiter of
// the SAME character and a run-length >= the opener's. A naive "toggle on any
// ``` line" (the pre-0.4.1 implementation) is wrong and was a real command-
// execution hole: a 4-backtick outer fence is not closed by a nested
// 3-backtick line under any standard renderer, so a claims table nested that
// way still reads as one inert example on GitHub while the naive toggle
// "closed" the outer fence early and unmasked it — live and executable under
// `--claims`. See docs/SECURITY.md finding 5.
function maskBody(bodyLines) {
  const out = [];
  let fenceChar = null; // "`" or "~" while inside a fence; null otherwise
  let fenceLen = 0;
  for (const l of bodyLines) {
    const m = l.match(/^\s*(`{3,}|~{3,})/);
    if (m) {
      const ch = m[1][0];
      const len = m[1].length;
      if (fenceChar === null) {
        fenceChar = ch;
        fenceLen = len;
        out.push("");
        continue;
      }
      if (ch === fenceChar && len >= fenceLen) {
        fenceChar = null;
        fenceLen = 0;
        out.push("");
        continue;
      }
      // A shorter, or different-character, delimiter inside an open fence is
      // literal fenced content (CommonMark) — falls through to the mask below.
    }
    if (fenceChar !== null) { out.push(""); continue; }
    if (/^\s*>/.test(l)) { out.push(""); continue; } // blockquote = quoted, not asserted
    out.push(l);
  }
  return out;
}

const H1_BANNED = [
  /\bas (?:we )?discussed\b/i, /\bchat history\b/i, /\byou'?ll remember\b/i,
  /\bas mentioned (?:earlier|above)\b/i, /\bremember when\b/i,
  /\bfrom (?:our|the) (?:last )?(?:conversation|session)\b/i,
];
// Negation guard: a sentence that *disclaims* reliance on chat is good, not bad.
const H1_NEGATED = /\b(?:no|not|never|without|don'?t|do not|shouldn'?t|should not|need not|no need to)\b[^.?!]*$/i;
const H3_RELATIVE = [
  /\byesterday\b/i, /\btoday\b/i, /\btomorrow\b/i, /\brecently\b/i,
  /\blast (?:session|week|night|time)\b/i, /\bthis (?:morning|afternoon|session)\b/i,
  /\ba (?:few )?(?:days|hours) ago\b/i,
];

// Loose, advisory prose linting on the masked body. Returns {rule, sev, line, msg}.
// H1 (self-containment) is scored far more heavily than the cosmetic H3/H4 nits;
// the caller splits them apart.
function lintProse(bodyLines, bodyOffset) {
  const masked = maskBody(bodyLines);
  const warns = [];
  const seenRefs = new Set();
  masked.forEach((l, i) => {
    const ln = bodyOffset + i + 1;
    for (const re of H1_BANNED) {
      const m = l.match(re);
      if (m) {
        const before = l.slice(0, m.index);
        if (!H1_NEGATED.test(before)) warns.push({ rule: "H1", sev: "warn", line: ln, msg: `self-containment: "${m[0]}"` });
      }
    }
    for (const re of H3_RELATIVE) {
      const m = l.match(re);
      if (m) warns.push({ rule: "H3", sev: "warn", line: ln, msg: `relative date: "${m[0]}"` });
    }
    const bare = l.match(/(?:^|[^\/\w])#(\d{1,6})\b/);
    if (bare && !/https?:\/\/|\]\(/.test(l) && !seenRefs.has(bare[1])) {
      seenRefs.add(bare[1]);
      warns.push({ rule: "H4", sev: "warn", line: ln, msg: `bare ref #${bare[1]} (use a URL or ticket id)` });
    }
  });
  return warns;
}

// Instructions a cold successor is primed to execute — first_action especially,
// since the protocol tells the receiver to run it first. A poisoned doc turns
// that trust into a code-exec channel, so we flag the classic download|shell and
// destructive one-liners. Advisory + score-docking, not gate-blocking, to stay
// fail-open (a real command like "npm test" must never be blocked).
// Deliberately narrow to keep false positives near zero: a pipe into a shell or
// interpreter (this already covers `curl … | sh`, `base64 -d | bash`, etc. — the
// dangerous part is the pipe target, not the fetch), a chained destructive rm,
// eval at a command position, sudo, writing into /etc, or netcat-exec.
const INJECTION_RE =
  /\|\s*(?:sudo\s+)?(?:sh|bash|zsh|fish|python[0-9.]*|node|ruby|perl|php)\b|;\s*rm\s+-[a-z]*[rf]|(?:^|[;&|]\s*)eval\s|\bsudo\s+\S|>\s*\/etc\/|\bnc\s+-[a-z]*e\b/i;

function detectInjection(header, maskedLines) {
  const flags = [];
  const fa = header && header.first_action ? String(header.first_action) : "";
  if (fa && INJECTION_RE.test(fa))
    flags.push({ field: "first_action", msg: `first_action contains a shell/download-exec pattern: "${firstMatch(fa, INJECTION_RE)}"` });
  maskedLines.forEach((l, i) => {
    if (INJECTION_RE.test(l))
      flags.push({ field: `body:L${i + 1}`, msg: `actionable prose contains a shell/download-exec pattern: "${firstMatch(l, INJECTION_RE)}"` });
  });
  return flags;
}

// Strip scaffold placeholders and markdown punctuation so we can measure how
// much *real* prose a line carries. "- **Tried and failed:** `<what>`" strips to
// "Tried and failed"; a real sentence survives. Used to reject keyword-only
// gaming of the negative-knowledge score.
function contentAfterColon(line) {
  const after = line.includes(":") ? line.slice(line.indexOf(":") + 1) : line;
  return after
    .replace(/`[^`]*`/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/FILL IN[^\n]*/gi, " ")
    .replace(/\b(?:TBD|TODO|XXX|FIXME|N\/A)\b/gi, " ")
    .replace(/\?\?\?/g, " ")
    .replace(/[*_>#`~\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The four categories of §2b. A category counts only when it matches on its own
// line AND that line carries >= 20 chars of real content beyond the label and
// the matched keyword. That defeats two gaming moves at once: dumping every
// keyword on one line, and leaving the scaffold's placeholder text in place.
const NEG_CATEGORIES = [
  { id: "tried-failed", re: /tried[\s-]*and[\s-]*failed|tried\b[^.]*\bfailed|attempted\b[^.]*\b(?:failed|abandoned)|failed\b[^.]*\bbecause/i },
  { id: "out-of-scope", re: /out[- ]of[- ]scope|deliberately not\b|descoped|not (?:building|built)\b|do(?:es)? ?n['o]?t build\b|won'?t build\b/i },
  { id: "reverted", re: /reverted|do(?:es)? ?n['o]?t re-?add|built[\s-]*then[\s-]*reverted|pulled (?:out|back)|rolled back/i },
  { id: "decisions", re: /\bdecisions?\b|\brationale\b|decided\b[^.]*\bbecause\b|chose(?:n)?\b[^.]*\b(?:because|over)\b|\bwhy we\b/i },
];

function negativeCategories(maskedLines) {
  const found = [];
  const usedLines = new Set();
  maskedLines.forEach((line, i) => {
    if (usedLines.has(i)) return;
    for (const cat of NEG_CATEGORIES) {
      if (found.includes(cat.id)) continue;
      if (cat.re.test(line)) {
        const content = contentAfterColon(line).replace(cat.re, " ").replace(/\s+/g, " ").trim();
        if (content.length >= 20) { found.push(cat.id); usedLines.add(i); break; }
      }
    }
  });
  return found;
}

// §3/§6/§8 section presence, detected on the masked BODY only (never the header,
// so the header's own verify_cmd/first_action keys can't satisfy these for free).
// The cue must land on a *structural* line — a heading, numbered step, or bullet
// — not buried inline in a paragraph, so a keyword-stuffed sentence can't claim
// three sections it doesn't have. Real docs put these on headings anyway.
function sectionPresence(maskedLines) {
  const structural = maskedLines.filter((l) => /^\s{0,3}#{1,6}\s|^\s*\d+[.)]\s|^\s*[-*+]\s/.test(l)).join("\n");
  return {
    canonicalSources: /canonical|source of truth|when (?:they|docs) disagree|code is truth/i.test(structural),
    nextAction: /next action|the (?:one )?first step|first step\b|do (?:this )?first|mirror this into/i.test(structural),
    verification: /verify the whole|verify (?:the whole )?thing|how to verify|##? ?8[.: ]|verification\b/i.test(structural),
  };
}

// Back-compat shim: some callers used structure(src). Preserve the shape.
function structure(src) {
  const { headerEndLine } = parseHeader(src);
  const bodyLines = src.split(/\r?\n/).slice(headerEndLine);
  const masked = maskBody(bodyLines);
  const s = sectionPresence(masked);
  return { negativeKnowledge: negativeCategories(masked).length > 0, ...s };
}

// Full evaluation with a transparent 0-100 rubric that rewards what the
// protocol says matters most: a valid header, preserved negative knowledge, and
// a self-contained, non-weaponized body.
function evaluate(src) {
  const { header, headerEndLine } = parseHeader(src);
  const headerErrors = validateHeader(header);
  const headerWarnings = headerAdvisories(header);
  const bodyLines = src.split(/\r?\n/).slice(headerEndLine);
  const masked = maskBody(bodyLines);
  const prose = lintProse(bodyLines, headerEndLine);
  const negCats = negativeCategories(masked);
  const sections = sectionPresence(masked);
  const injection = detectInjection(header, masked);

  // Rubric (documented in PROTOCOL.md §6b), total 100:
  //  Header validity ....... 45  (each of 7 required checks satisfied)
  //  Negative knowledge .... 20  (5 per §2b category, substantive & on its own line)
  //  Section completeness .. 15  (canonical sources, next action, verification)
  //  Self-containment ...... 12  (H1 + injection; -6 per distinct hit, floored 0)
  //  Prose cleanliness ..... 8   (H3/H4; -2 per distinct warning, floored 0)
  const badKeys = new Set(headerErrors.map((e) => e.key));
  const headerFieldsOk = header ? REQUIRED_KEYS.filter((k) => !badKeys.has(k)).length : 0;
  const headerScore = Math.round((headerFieldsOk / REQUIRED_KEYS.length) * 45);
  const negScore = negCats.length * 5;
  const secScore = [sections.canonicalSources, sections.nextAction, sections.verification].filter(Boolean).length * 5;
  const h1Count = prose.filter((w) => w.rule === "H1").length;
  const safetyHits = h1Count + injection.length;
  const safetyScore = Math.max(0, 12 - safetyHits * 6);
  const proseNits = prose.filter((w) => w.rule !== "H1").length;
  const proseScore = Math.max(0, 8 - proseNits * 2);
  const score = Math.round(headerScore + negScore + secScore + safetyScore + proseScore);

  const structureOut = { negativeKnowledge: negCats.length > 0, negCategories: negCats, ...sections };
  return {
    header,
    headerErrors,
    headerWarnings,
    prose,
    injection,
    structure: structureOut,
    subscores: { header: headerScore, negative: negScore, sections: secScore, selfContainment: safetyScore, prose: proseScore },
    score,
    valid: headerErrors.length === 0,
  };
}

module.exports = {
  localISODate,
  maskBody,
  parseHeader,
  validateHeader,
  headerAdvisories,
  lintProse,
  structure,
  detectInjection,
  evaluate,
  REQUIRED_KEYS,
  CURRENT_PROTOCOL_VERSION,
};
