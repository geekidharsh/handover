#!/bin/bash
# Repo-aware verification tests for bin/handover-lint.js (--repo / --verify).
# Builds a throwaway git repo so the SHA/drift/date checks have real state.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LINT="$ROOT/bin/handover-lint.js"
PASS=0; FAIL=0
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

REPO="$WORK/repo"
mkdir -p "$REPO"
cd "$REPO" || exit 1
git init -q
git config user.email t@t; git config user.name t
echo one > a.txt; git add -A; git commit -qm one
PRIOR=$(git rev-parse HEAD)
echo two > b.txt; git add -A; git commit -qm two
HEAD_SHA=$(git rev-parse HEAD)

# Write a handover doc into the repo. Args: file sha date verify_cmd status
mkdoc() {
  cat > "$1" <<EOF
---
protocol_version: 1
handoff: t
author: tester
iso_date: $3
true_at_sha: $2
shape: handoff
first_action: run the migration then wire the /api route
verify_cmd: $4
status: $5
---
# T
## 3 Canonical sources (code is truth)
## 5 Negative knowledge
- **Tried and failed:** reusing the member Order model, non-null user_id broke three member queries
- **Deliberately out of scope:** saved payment methods, post-launch and not built yet
- **Built then reverted:** client-side totals, the browser disagreed with the server on tax
- **Decisions:** a separate table, chosen because it keeps every member query unchanged
## 6 Next action
1. **run the migration first**
## 8 Verify the whole thing still holds
EOF
}

# assert: name expected_rc expect_substr -- command...
a() {
  local name="$1" want="$2" sub="$3"; shift 3
  local out rc
  out=$("$@" 2>&1); rc=$?
  if [ "$rc" -eq "$want" ] && echo "$out" | grep -q "$sub"; then
    PASS=$((PASS+1))
  else
    echo "  FAIL: $name (want rc=$want /$sub/, got rc=$rc)"; echo "$out" | grep VERIFICATION | head -1
    FAIL=$((FAIL+1))
  fi
}

cd "$REPO"

mkdoc "$REPO/ok.md"        "$HEAD_SHA" 2026-07-11 "true" in_progress
mkdoc "$REPO/fab.md"       "deadbeef1234" 2026-07-11 "true" in_progress
mkdoc "$REPO/drift.md"     "$PRIOR" 2026-07-11 "true" in_progress
mkdoc "$REPO/future.md"    "$HEAD_SHA" 2099-01-01 "true" in_progress
mkdoc "$REPO/donefail.md"  "$HEAD_SHA" 2026-07-11 "false" done
mkdoc "$REPO/donepass.md"  "$HEAD_SHA" 2026-07-11 "true" done
mkdoc "$REPO/uncommit.md"  "uncommitted" 2026-07-11 "true" in_progress

a "default = structure only, not-checked"      0 "NOT-CHECKED"          node "$LINT" "$REPO/ok.md"
a "--repo real SHA = verified"                 0 "VERIFIED"             node "$LINT" "$REPO/ok.md" --repo
a "--repo fabricated SHA = failed"             1 "fabricated or from"   node "$LINT" "$REPO/fab.md" --repo
a "--repo drift = stale warn (rc0)"            0 "STALE-OR-UNPROVEN"    node "$LINT" "$REPO/drift.md" --repo
a "--repo drift shows commit count"            0 "1 commit"             node "$LINT" "$REPO/drift.md" --repo
a "--repo --strict drift = fail (rc1)"         1 "STALE-OR-UNPROVEN"    node "$LINT" "$REPO/drift.md" --repo --strict
a "--repo future date = failed"                1 "future"               node "$LINT" "$REPO/future.md" --repo
a "--verify done + failing cmd = failed"       1 "not done"             node "$LINT" "$REPO/donefail.md" --verify
a "--verify done + passing cmd = verified"     0 "VERIFIED"             node "$LINT" "$REPO/donepass.md" --verify
a "--repo done without --verify = unproven"    0 "done-unproven"        node "$LINT" "$REPO/donepass.md" --repo
a "--repo uncommitted SHA = warned"            0 "uncommitted"          node "$LINT" "$REPO/uncommit.md" --repo

# Security: a hostile true_at_sha must never reach a shell. --repo on this doc
# must NOT create the canary file, and must report the value as unverifiable.
cat > "$REPO/inject.md" <<EOF
---
protocol_version: 1
handoff: evil
author: attacker
iso_date: 2026-07-11
true_at_sha: \$(touch $WORK/CANARY)\$
shape: handoff
first_action: do the thing
verify_cmd: npm test
status: in_progress
---
# body
EOF
rm -f "$WORK/CANARY"
node "$LINT" "$REPO/inject.md" --repo >/dev/null 2>&1
if [ -f "$WORK/CANARY" ]; then echo "  FAIL: command injection via true_at_sha executed!"; FAIL=$((FAIL+1)); else PASS=$((PASS+1)); fi

# Outside any git repo, repo checks degrade gracefully (never crash / never block).
NOGIT="$WORK/nogit"; mkdir -p "$NOGIT"; cp "$REPO/ok.md" "$NOGIT/ok.md"
a "non-git dir --repo = graceful, no crash"    0 "UNVERIFIED-NO-REPO"   bash -c "cd '$NOGIT' && node '$LINT' '$NOGIT/ok.md' --repo"

# A "done" that was never proven must be loud even in plain structure-only mode
# (the most likely cold-user invocation).
a "plain lint on done doc warns unproven"      0 "done-unproven"        node "$LINT" "$REPO/donepass.md"

# --claims: run each claim-table row's own verify command.
mkclaims() { # file: doc with a claims table; $2 = the second row's command
  mkdoc "$1" "$HEAD_SHA" 2026-07-11 "true" in_progress
  cat >> "$1" <<EOF
## 2. Current state as verifiable claims
| Claim | Verify |
|---|---|
| commit a exists | \`test -f a.txt\` |
| second claim | \`$2\` |
| a declared belief [belief, unverified] | none |
EOF
}
mkclaims "$REPO/claimsok.md"  "test -f b.txt"
mkclaims "$REPO/claimsbad.md" "test -f does-not-exist.txt"
a "--claims all hold = rc0"                    0 "2/2 claim checks hold" node "$LINT" "$REPO/claimsok.md" --claims
a "--claims one fails = rc1, localized"        1 "no longer holds"       node "$LINT" "$REPO/claimsbad.md" --claims

# A backticked cell in a NON-verify table must never execute. The canary file
# must not exist after --claims.
mkclaims "$REPO/claimscanary.md" "test -f a.txt"
cat >> "$REPO/claimscanary.md" <<EOF
## Appendix: some other table
| Thing | Notes |
|---|---|
| x | \`touch $WORK/CLAIMCANARY\` |
EOF
rm -f "$WORK/CLAIMCANARY"
node "$LINT" "$REPO/claimscanary.md" --claims >/dev/null 2>&1
if [ -f "$WORK/CLAIMCANARY" ]; then echo "  FAIL: --claims executed a non-verify table cell!"; FAIL=$((FAIL+1)); else PASS=$((PASS+1)); fi

# A claims table inside a FENCED CODE BLOCK is an illustrative example, never an
# instruction. (Found by adversarial review: extractClaims originally read raw
# lines, so a fenced example table executed.)
mkdoc "$REPO/claimsfenced.md" "$HEAD_SHA" 2026-07-11 "true" in_progress
cat >> "$REPO/claimsfenced.md" <<EOF
## 2. Current state as verifiable claims
Here is an example of the table format, not a live table:

\`\`\`
| Claim | Verify |
|---|---|
| example row | \`touch $WORK/FENCECANARY\` |
\`\`\`
EOF
rm -f "$WORK/FENCECANARY"
node "$LINT" "$REPO/claimsfenced.md" --claims >/dev/null 2>&1
if [ -f "$WORK/FENCECANARY" ]; then echo "  FAIL: --claims executed a table inside a code fence!"; FAIL=$((FAIL+1)); else PASS=$((PASS+1)); fi

# MISMATCHED fence lengths (a 4-backtick outer fence around a 3-backtick inner
# fence) must mask the same as a same-length pair. A naive boolean toggle on
# any ``` line closes the outer fence on the inner 3-backtick line, unmasking
# the table between them — a real command-execution hole found by adversarial
# review (see docs/SECURITY.md finding 5). CommonMark itself does not treat
# the inner 3-backtick line as a closer, so any renderer (GitHub included)
# shows this as one inert nested example.
mkdoc "$REPO/claimsnested.md" "$HEAD_SHA" 2026-07-11 "true" in_progress
cat >> "$REPO/claimsnested.md" <<'EOF'
## 2. Current state as verifiable claims
EOF
{
  printf '%s\n' '````'
  printf '%s\n' "Here's what NOT to do — an example claims table shown inside a fence so it's inert:"
  printf '%s\n' '```'
  printf '%s\n' '| Claim | Verify |'
  printf '%s\n' '|---|---|'
  printf '| pwned | `touch %s/NESTEDCANARY` |\n' "$WORK"
  printf '%s\n' '````'
} >> "$REPO/claimsnested.md"
rm -f "$WORK/NESTEDCANARY"
node "$LINT" "$REPO/claimsnested.md" --claims >/dev/null 2>&1
if [ -f "$WORK/NESTEDCANARY" ]; then echo "  FAIL: --claims executed a table nested in a mismatched-length fence!"; FAIL=$((FAIL+1)); else PASS=$((PASS+1)); fi

# "Verified By" is a roster column, not a command column. Only an exact
# Verify/Verification/Check header arms execution.
mkdoc "$REPO/claimsloose.md" "$HEAD_SHA" 2026-07-11 "true" in_progress
cat >> "$REPO/claimsloose.md" <<EOF
## Reviewers
| Area | Verified By |
|---|---|
| auth | \`touch $WORK/LOOSECANARY\` |
EOF
rm -f "$WORK/LOOSECANARY"
node "$LINT" "$REPO/claimsloose.md" --claims >/dev/null 2>&1
if [ -f "$WORK/LOOSECANARY" ]; then echo "  FAIL: --claims executed a 'Verified By' roster cell!"; FAIL=$((FAIL+1)); else PASS=$((PASS+1)); fi

# localISODate must agree with the shell's local date even in a timezone far
# from UTC (the toISOString UTC-slice bug stamped tomorrow's date after ~17:00
# US-Pacific).
for TZTEST in Pacific/Kiritimati Etc/GMT+12; do
  NODE_D=$(TZ="$TZTEST" node -e 'console.log(require("'"$ROOT"'/bin/lib/handover-doc.js").localISODate())')
  SHELL_D=$(TZ="$TZTEST" date +%F)
  if [ "$NODE_D" = "$SHELL_D" ]; then PASS=$((PASS+1)); else echo "  FAIL: localISODate $NODE_D != date $SHELL_D in $TZTEST"; FAIL=$((FAIL+1)); fi
done

echo "verify.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
