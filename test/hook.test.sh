#!/bin/bash
# Harness-independent git pre-commit hook tests (hooks/pre-commit.sample).
# Builds a throwaway repo, installs the hook, and checks that it blocks a bad
# handoff, passes a good one, and — critically — fails OPEN when Handover is
# not installed.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

REPO="$WORK/repo"; mkdir -p "$REPO"; cd "$REPO" || exit 1
git init -q; git config user.email t@t; git config user.name t
echo x > a.txt; git add -A; git commit -qm init
cp "$ROOT/hooks/pre-commit.sample" .git/hooks/pre-commit; chmod +x .git/hooks/pre-commit
SHA=$(git rev-parse HEAD)

mkdoc() { # file sha
  cat > "$1" <<EOF
---
protocol_version: 1
handoff: t
author: tester
iso_date: $(date +%F)
true_at_sha: $2
shape: handoff
first_action: apply the migration, then wire the route
verify_cmd: true
status: in_progress
---
# T
## 3 Canonical sources (code is truth)
## 5 Negative knowledge
- **Tried and failed:** reusing the member Order model, non-null user_id broke member queries
- **Deliberately out of scope:** saved payment methods, not built and not planned here
- **Built then reverted:** client-side totals, the browser disagreed with the server on tax
- **Decisions:** a separate table, chosen because it keeps every member query unchanged
## 6 Next action
1. **apply the migration first**
## 8 Verify the whole thing still holds
EOF
}

ok() { PASS=$((PASS+1)); }
no() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

# 1. A malformed handoff must block the commit.
mkdoc "$REPO/HANDOVER_bad.md" "FILL IN"
git add HANDOVER_bad.md
if HANDOVER_BIN="$ROOT/bin" git commit -qm bad >/dev/null 2>&1; then no "malformed handoff was committed"; else ok; fi

# 2. Fail-open: with Handover absent, the same commit must succeed.
if HANDOVER_BIN=/nonexistent git commit -qm "fail open" >/dev/null 2>&1; then ok; else no "hook failed CLOSED when handover is not installed"; fi
git reset -q --hard HEAD~1 2>/dev/null || git rm -q --cached HANDOVER_bad.md 2>/dev/null
rm -f HANDOVER_bad.md

# 3. A valid handoff must pass.
mkdoc "$REPO/HANDOVER_good.md" "$SHA"
git add HANDOVER_good.md
if HANDOVER_BIN="$ROOT/bin" git commit -qm good >/dev/null 2>&1; then ok; else no "valid handoff was blocked"; fi

# 4. A non-handover file must be ignored entirely.
echo y > note.md; git add note.md
if HANDOVER_BIN="$ROOT/bin" git commit -qm note >/dev/null 2>&1; then ok; else no "unrelated file was blocked"; fi

echo "hook.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
