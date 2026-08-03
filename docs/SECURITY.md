# Security & threat model

Handover is trust infrastructure, so its own trust boundaries have to be
explicit. This doc states what it defends against, what it does *not*, and the
findings from the 0.3.0 hardening review. It is deliberately honest: an
overtrusted guardrail is worse than none.

## Trust boundaries

| Actor | Trusted? | Why |
|---|---|---|
| The user, via chat | yes | they own the session |
| Claude Code (hook inputs: `tool_name`, `tool_input`, `cwd`, `session_id`) | yes | comes from the harness, not from content |
| A **handoff document** (`HANDOVER_*.md`, incl. a cold agent's own inheritance) | **no** | it may be authored by another agent or arrive from another repo; it is *data*, not instructions |
| A repo-local `.handover/policy.json` | conditionally | it governs the gate, but an agent in the repo can write it (see below) |
| A doc's `verify_cmd` under `--verify` | opt-in | running it is user-consented, same trust as `make test` |
| A doc's per-claim commands under `--claims` | opt-in | same consent and same trust level as `verify_cmd`; gated further, see finding 4 |

The load-bearing rule: **nothing read from a document is ever executed or
believed on its face.** The score measures shape; only the opt-in verification
pass, run inside the doc's own repo, touches ground truth.

## What Handover defends against

- **Silent Done.** `status: done` with no `verify_cmd` is a hard header error;
  with `--verify`, done is refused unless the command exits 0.
- **Fabricated freshness.** `--repo` rejects a `true_at_sha` not present in the
  repo and warns on drift, so a doc can't claim to be current when it isn't.
- **Score gaming.** Negative-knowledge and section scores require substance on
  structural lines, not keywords; placeholders in required fields fail.
- **Handoff-as-injection.** A shell/download-exec pattern in `first_action`
  (the field a cold agent runs first) is flagged and docks the score.
- **A self-neutered gate.** Edits to the gate's own policy are forced to `ask`,
  and `audit` shows whether the active policy is the trusted default or an
  uncommitted in-repo override.
- **Route-around and loops.** Sticky cross-tool denials; second-occurrence
  failure interruption (pre-existing, unchanged).

## Review findings (0.3.0)

1. **Command injection in the verification layer (introduced then fixed in this
   release).** The first cut of `--repo` built git commands by string-inter-
   polating `true_at_sha` and ran even for an invalid header, so a doc with
   `true_at_sha: $(…)` executed on `lint --repo`. A canary test confirmed it.
   **Fix:** all git probes run shell-free via `execFileSync("git", [...args])`
   in `bin/handover-lint.js` and `hooks/audit.js`; a bare-SHA regex guards the
   probe as defense in depth; `verify_cmd` is the only shell path and is skipped
   for an invalid header. Regression: the `inject.md` canary in
   `test/verify.test.sh`.
2. **Self-neutering policy.** `Write`/`Edit` are route-around-exempt, so an agent
   could rewrite `.handover/policy.json` to drop every `deny`. **Fix:** the
   policy self-edit guard (`ask`) + `audit` provenance report. This is
   *detection and friction*, not prevention — a user who approves the edit, or a
   committed-but-permissive policy, still applies.
3. **Score ≠ truth.** A high structural score was being read as "trustworthy."
   **Fix:** output and docs split STRUCTURE from VERIFICATION; the score line
   carries "shape only — not proof of truth."

## Review findings (0.4.0)

4. **Over-broad command extraction in `--claims` (introduced then fixed in this
   release).** The first cut of per-claim verification decided what to execute by
   scanning **raw** document lines for a table whose last column header merely
   *contained* "verif". Adversarial review proved two working escapes with a
   canary payload: (a) a claims table inside a fenced code block — an
   illustrative example, or a hostile document quoted inside a legitimate one —
   was parsed as live and executed; (b) any table with a `Verified By` /
   `Verification Owner` column had its cells executed, so a reviewer roster
   became an execution list. **Fix:** extraction now runs on **fence-masked**
   lines (the same masking the prose linter uses), and the opt-in header is an
   **exact** match against `Verify` / `Verification` / `Verify cmd` /
   `Verify command` / `Check` / `How to verify`. Regressions: the fenced-table
   and `Verified By` canaries in `test/verify.test.sh`.

   The durable lesson, and the reason this is written up rather than quietly
   patched: **every new place a document's own text can reach a shell must be
   opt-in twice** — once by the user (a flag) and once by the document (an
   unambiguous, exact marker) — and must read from the same masked view the rest
   of the tooling uses. A second parser over raw text is a second attack surface.
5. **Fence-masking didn't track fence length (found in a follow-up security
   review, introduced then fixed in this release).** Finding 4's fix — mask
   fenced code blocks before extracting claims — had its own gap: `maskBody()`
   toggled a plain boolean on any line matching three-or-more backticks,
   regardless of run length. CommonMark closes a fence only on a delimiter of
   the *same character* and *at least as many* repeats as the opener — so a
   4-backtick outer fence is not closed by a nested 3-backtick line under
   GitHub's renderer or any standard viewer. The naive toggle disagreed: it
   closed the outer fence early on the inner 3-backtick line, unmasking a
   claims table that every human reviewer would still see as one inert,
   fully-fenced example. A document exploiting this scores as a normal,
   reviewable doc and executes an attacker's command the moment a user who
   *did* visually review it runs `--claims`. **Fix:** `maskBody()` tracks the
   opening fence's character and run-length and only closes on a
   same-character delimiter of equal-or-greater length, matching CommonMark.
   Regression: the `claimsnested.md` mismatched-fence canary in
   `test/verify.test.sh`, alongside the same-length case finding 4 already
   covered. Same lesson as finding 4, sharper: a masking layer that another
   security gate *depends on* has to be exactly as correct as the spec it's
   approximating, not just "good enough to pass the one test written for it."

## What it deliberately does NOT do (residual risk)

- **The mutation gate is regex over command strings, not a sandbox.** Variable
  indirection (`g=push; git $g -f`), `eval`, aliases, base64-decoding, or
  writing a script then executing it can bypass it. It raises the cost of a
  mistake; it is not containment. Run agents under real OS/permission limits too.
- **Command-string matching over-triggers on prose.** Because the gate inspects
  Bash command strings, a `git commit` whose *message* contains a destructive
  example (e.g. `rm -rf ~`) can trip the destructive-fs rule. Observed live.
  Future refinement: exclude commit-message bodies.
- **STRUCTURE cannot judge truth.** A determined author can write four plausible
  but false negative-knowledge lines. Only `--verify` and a human reading the
  prose close that.
- **No provenance/signing.** `author` is self-declared, not authenticated.
  Forged *negative knowledge* ("do not re-add X") is the highest-leverage attack
  on a receiver and is not yet cryptographically attributable — tracked as a
  roadmap item in [STALENESS.md](STALENESS.md).
- **Fail-open by design.** A crashed hook or malformed policy emits nothing and
  Claude Code's normal permissions apply. Handover tightens the default posture;
  it is never the only line of defense.

- **`--claims` trusts exit codes only.** A claim command that exits 0 regardless
  of the truth of the claim (`git log …`, a bare `ls`) passes vacuously. Write
  claim checks like tests. The tooling cannot tell a real check from a
  decorative one.

## Reporting

See the root [SECURITY.md](../SECURITY.md) for how to report. In short: a GitHub
security advisory for anything sensitive, an issue otherwise. Note the scope
carve-outs there — a false document scoring 100/100 is documented behavior, but
any path that gets document content to a shell *without* `--verify`/`--claims`
is a real vulnerability.
