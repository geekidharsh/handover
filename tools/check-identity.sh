#!/usr/bin/env bash
# check-identity — verify name/repo/license stay consistent across every file that
# states them, instead of trusting manual sync. Canonical source: package.json.
#
# DRY in the direction that matters here: not "generate every file from one
# template" (these files have different shapes and audiences — a NOTICE file
# and a paper byline are not interchangeable) but "one place to edit the VALUE,
# one command to verify every place that repeats it still agrees." Re-run this
# any time the name, repo, or license changes, and after any squash-publish
# (which mints new commit SHAs and stales every true_at_sha anchor in the tree).
#
# Usage: ./tools/check-identity.sh
# Exit: 0 = consistent, 1 = drift found (prints exactly what and where).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NAME=$(node -e '
  const pkg = require("./package.json");
  const a = pkg.author;
  process.stdout.write((a && (typeof a === "string" ? a : a.name)) || "");
')
REPO=$(node -e '
  const pkg = require("./package.json");
  process.stdout.write((pkg.repository && pkg.repository.url || "")
    .replace(/^git\+/, "").replace(/\.git$/, ""));
')
LICENSE=$(node -e 'process.stdout.write(require("./package.json").license || "")')
REPO_SLUG=$(echo "$REPO" | sed -E 's#https?://github.com/##')

if [ -z "$NAME" ] || [ -z "$REPO" ] || [ -z "$LICENSE" ]; then
  echo "  DRIFT  package.json — missing a canonical field itself (name=\"$NAME\" repo=\"$REPO\" license=\"$LICENSE\")"
fi

FAIL=0
check() { # file, pattern, label
  local file="$1" pattern="$2" label="$3"
  [ -f "$file" ] || return 0
  if ! grep -q "$pattern" "$file" 2>/dev/null; then
    echo "  DRIFT  $file — missing/mismatched $label (want: $pattern)"
    FAIL=1
  fi
}

echo "Canonical (from package.json): name=\"$NAME\"  repo=\"$REPO_SLUG\"  license=\"$LICENSE\""
echo ""

check "NOTICE" "$NAME" "author name"
check "CITATION.cff" "$REPO" "repo URL"
check "CITATION.cff" "$LICENSE" "license"
check ".claude-plugin/plugin.json" "$NAME" "author name"
check "README.md" "$REPO_SLUG" "repo slug (install command)"
check "paper/handover.html" "$REPO_SLUG" "repo slug (byline/footer)"
check "paper/handover.html" "$NAME" "author byline"

# true_at_sha anchors: list them so a human decides which need re-anchoring after
# a squash-publish, rather than silently trusting an old one. Not pass/fail on its
# own (a valid anchor mid-development is fine) — informational, always printed.
echo ""
echo "Freshness anchors on file (verify each still resolves — handover-lint --repo does this per-doc):"
grep -rl "^true_at_sha:" --include="*.md" --exclude-dir=.claude --exclude-dir=.git --exclude-dir=node_modules . 2>/dev/null | while read -r f; do
  sha=$(grep "^true_at_sha:" "$f" | head -1 | sed 's/true_at_sha:[[:space:]]*//')
  echo "  $f -> $sha"
done

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "consistent — no drift found"
else
  echo "DRIFT FOUND — fix the files above, or update package.json if the canonical value changed"
fi
exit $FAIL
