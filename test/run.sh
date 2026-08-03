#!/bin/bash
set -u
cd "$(dirname "$0")/.."
PASS=0
FAIL=0
rm -f ~/.handover/sessions/sbtest*.json

FIXTURE=/tmp/handover-example-fixture
rm -rf "$FIXTURE"
mkdir -p "$FIXTURE/.handover"
cp examples/example-project.policy.json "$FIXTURE/.handover/policy.json"

check() {
  local name="$1" file="$2" script="$3" expect="$4"
  local out
  out=$(node "hooks/$script" < "test/$file")
  if echo "$out" | grep -q "$expect"; then
    echo "PASS: $name"; PASS=$((PASS + 1))
  else
    echo "FAIL: $name"; echo "  expected to contain: $expect"; echo "  got: $out"; FAIL=$((FAIL + 1))
  fi
}

check_empty() {
  local name="$1" file="$2" script="$3" out
  out=$(node "hooks/$script" < "test/$file")
  if [ -z "$out" ]; then
    echo "PASS: $name"; PASS=$((PASS + 1))
  else
    echo "FAIL: $name"; echo "  expected no output, got: $out"; FAIL=$((FAIL + 1))
  fi
}

# expect exit code + optional stdout substring for a raw command
check_cmd() {
  local name="$1" want_rc="$2" expect="$3"; shift 3
  local out rc
  out=$("$@" 2>&1); rc=$?
  if [ "$rc" -eq "$want_rc" ] && echo "$out" | grep -q "$expect"; then
    echo "PASS: $name"; PASS=$((PASS + 1))
  else
    echo "FAIL: $name"; echo "  wanted rc=$want_rc containing: $expect"; echo "  got rc=$rc: $out" | head -3; FAIL=$((FAIL + 1))
  fi
}

echo "-- mutation gate --"
check "mcp read auto-allowed" pre_read.json gate.js '"permissionDecision":"allow"'
check "plain SELECT auto-allowed" pre_select.json gate.js '"permissionDecision":"allow"'
check "mcp write asks" pre_write.json gate.js '"permissionDecision":"ask"'
check "force-push denied" pre_forcepush.json gate.js '"permissionDecision":"deny"'
check "force-with-lease asks, not denies" pre_forcewithlease.json gate.js '"permissionDecision":"ask"'
check "destructive sql denied" pre_truncate.json gate.js '"permissionDecision":"deny"'
check "route-around of denial caught" pre_routearound.json gate.js "reroute"
check "TRUNCATE without TABLE keyword still denied" pre_truncate_notable.json gate.js '"permissionDecision":"deny"'
check "DELETE without WHERE via escaped Bash string denied" pre_delete_nowhere_bash.json gate.js '"permissionDecision":"deny"'
check_empty "DELETE with WHERE via Bash passes through" pre_delete_where_bash.json gate.js
check "rm -rf \$HOME denied" pre_rm_home.json gate.js '"permissionDecision":"deny"'
check "Task tool can't launder a denied action" pre_task_routearound.json gate.js "reroute"
check "example project policy denies gh pr merge" pre_prmerge_example_policy.json gate.js '"permissionDecision":"deny"'
check_empty "unrelated bash passes through" pre_passthrough.json gate.js

echo "-- loop detector --"
check_empty "successful tool result ignored" post_ok.json loop.js
check_empty "success message containing failure words ignored" post_success_zero_errors.json loop.js
check_empty "first failure stays silent" post_fail.json loop.js
check "second identical failure flagged" post_fail.json loop.js '"decision":"block"'
# false-positive fix: an Edit whose echoed content mentions "conflict/failure" is a success, not a failure
check_empty "edit content with failure words not flagged (1st)" post_edit_content_failure.json loop.js
check_empty "edit content with failure words not flagged (2nd)" post_edit_content_failure.json loop.js
# success-clears-fingerprint: fail (silent) -> success (clears) -> fail must be #1 again (silent)
rm -f ~/.handover/sessions/sbtest_clear.json
node hooks/loop.js < test/post_merge_fail.json >/dev/null
node hooks/loop.js < test/post_merge_success.json >/dev/null
check_empty "success clears fingerprint, next failure is #1 again" post_merge_fail.json loop.js

echo "-- handover header gate --"
GOOD=/tmp/HANDOVER_good.md; BAD=/tmp/HANDOVER_bad.md
cp examples/handover.example.md "$GOOD"
printf '%s\n' '---' 'handoff: x' 'status: done' '---' '# oops, missing required fields' > "$BAD"
GOOD_OUT=$(printf '{"tool_name":"Write","tool_input":{"file_path":"%s"}}' "$GOOD" | node hooks/handover-gate.js)
[ -z "$GOOD_OUT" ] && { echo "PASS: valid handover header passes gate"; PASS=$((PASS+1)); } || { echo "FAIL: valid handover header passes gate: $GOOD_OUT"; FAIL=$((FAIL+1)); }
BAD_OUT=$(printf '{"tool_name":"Write","tool_input":{"file_path":"%s"}}' "$BAD" | node hooks/handover-gate.js)
if echo "$BAD_OUT" | grep -q '"decision":"block"'; then echo "PASS: malformed handover header blocked"; PASS=$((PASS+1)); else echo "FAIL: malformed handover header blocked: $BAD_OUT"; FAIL=$((FAIL+1)); fi
NONHAND=$(printf '{"tool_name":"Write","tool_input":{"file_path":"/tmp/regular.md"}}' | node hooks/handover-gate.js)
[ -z "$NONHAND" ] && { echo "PASS: non-handover file ignored by gate"; PASS=$((PASS+1)); } || { echo "FAIL: non-handover file ignored: $NONHAND"; FAIL=$((FAIL+1)); }

echo "-- policy tamper-evidence --"
check "policy edit via Write asks" pre_policy_edit_write.json gate.js '"permissionDecision":"ask"'
check "policy edit via shell redirect asks" pre_policy_edit_bash.json gate.js '"permissionDecision":"ask"'
check_empty "reading the policy passes through" pre_policy_read_bash.json gate.js
check "rm -rf \${HOME} denied" pre_rm_home_braced.json gate.js '"permissionDecision":"deny"'
check_cmd "audit reports the active gate policy" 0 "Active gate policy" node hooks/audit.js

echo "-- lint + bench --"
check_cmd "example lints valid (rc 0)" 0 "valid" node bin/handover-lint.js examples/handover.example.md
check_cmd "template lints invalid (rc 1)" 1 "INVALID" node bin/handover-lint.js templates/handover.template.md
check_cmd "bad handover scores below --min=80" 1 "STRUCTURE" node bin/handover-lint.js bench/scenarios/reverted-feature/bad.handover.md --min=80
check_cmd "bench shows good beats bad" 0 "delta (good - bad)" node bench/run.js
# regression: a doc with NO header must not be credited header points (was scoring 53)
printf '# just a title\n\nsome body, no header\n' > /tmp/handover-noheader.md
check_cmd "headerless doc scores below --min=20" 1 "STRUCTURE" node bin/handover-lint.js /tmp/handover-noheader.md --min=20

echo "-- core rubric unit tests --"
check_cmd "core validator unit suite (doc.test.js)" 0 "0 failed" node test/doc.test.js

echo "-- repo verification tests --"
check_cmd "repo verification suite (verify.test.sh)" 0 "0 failed" bash test/verify.test.sh

echo "-- harness-independent git hook --"
check_cmd "pre-commit hook suite (hook.test.sh)" 0 "0 failed" bash test/hook.test.sh

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
