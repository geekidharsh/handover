# What goes stale, and what enforces freshness

A handoff records *belief at a moment*. The moment passes; the belief rots. This
file maps every way a Handover artifact drifts from reality, what now catches it,
and what still doesn't. It is the design rationale behind the checks in
`bin/lib/handover-doc.js` (shape) and `bin/handover-lint.js` (truth).

## The staleness surface

| What drifts | Why it rots | Caught by (now) | Residual gap |
|---|---|---|---|
| `true_at_sha` vs HEAD | code moves after the doc is written | `--repo` drift check (`git rev-list sha..HEAD`), lists changed files | drift is reported, not *localized* to which claims it invalidates |
| A state claim ("route returns a stub") | the code it describes changes | each claim carries a verify command (H2); `--verify` runs `verify_cmd`; `--claims` runs each claim row's own command and names the rows that no longer hold | claim commands are trusted like `verify_cmd` (exit-code contract; a vacuously-passing command passes) |
| `status: done` | marked done on belief, never proven | `--verify` refuses done unless `verify_cmd` exits 0; without it, `done-unproven` warning | nothing forces `--verify` at hand-off time (see "enforcement we should add") |
| Canonical-source ranking (§3) | a doc it points to gets rewritten | H6 supersession discipline (prose) | not machine-checked; no link-liveness or freshness check on referenced docs |
| A PR / ticket reference | PR merges, ticket closes | `--repo` doesn't yet resolve PR/ticket state | no `gh`/tracker probe on `first_action`'s PR |
| `iso_date` | copied forward, or fabricated | `--repo` flags a future date | a *plausibly-old* wrong date (past but incorrect) isn't caught |
| Negative knowledge ("do not re-add X") | the reason expires — X becomes needed again | nothing | negative knowledge has no expiry or re-review trigger; it can outlive its truth |
| The policy that governs the gate | an agent edits `.handover/policy.json` | edits forced to `ask`; `audit` flags uncommitted/untracked overrides | detection is after-the-fact; a committed-but-malicious policy still applies |
| The protocol itself | the doc targets v1, the tool is v2 | `protocol_version` validated against known set | no migration path; an old doc just fails on an unknown version |

## Enforcements now in place

Deterministic, no-LLM, and split by trust value:

**Shape (always on, `handover-doc.js`)**
- Header shape: 7 required fields, enum/date/SHA well-formedness, placeholder rejection (`FILL IN`, `<…>`, `TBD/TODO/???`).
- No silent Done: `status: done` with an empty `verify_cmd` is a hard error.
- Negative knowledge scored on *substance* (own line, real content past the label), not keyword presence.
- Sections detected only on structural lines, so keyword-stuffing can't fake them.
- Self-containment (H1) weighted heavily; injection patterns in `first_action`/actionable prose flagged.

**Truth (opt-in, `handover-lint.js`)**
- `--repo`: `true_at_sha` must exist in the repo; drift computed and surfaced; future date fails. Shell-free probes, safe on untrusted docs.
- `--verify`: runs `verify_cmd` — the only thing that converts *done* from belief to fact. `--strict` makes drift/unproven-done non-zero.

**Behavior (runtime, `gate.js`/`audit.js`)**
- Mutation gate (allow/ask/deny), sticky denials, loop detector.
- Policy self-edit guard + `audit` provenance report (default vs in-repo, committed vs uncommitted).

## Enforcement we should add (ranked)

1. **A hand-off-time gate that requires a fresh `--verify`.** Today verification is opt-in; the highest-leverage next step is a `PreToolUse`/commit hook that refuses to publish a `status: done` handoff unless `handover-lint --verify` passed against the current HEAD. Turns "should verify" into "did verify." (Partially mitigated: since 0.4.0 a plain lint of a `done` doc warns `done-unproven` loudly instead of scrolling by silent.)
2. ~~**Per-claim verification.**~~ **Shipped as `--claims` (0.4.0):** each claim-table row's verify command runs individually and failing rows are named. Residual: exit-code contract only — a vacuously-passing command still passes.
3. **Drift-to-claim mapping.** When HEAD is ahead of `true_at_sha`, intersect the changed files with the files each claim references, and mark only the claims whose evidence moved. A 40-commit drift that touched none of the referenced files is not actually stale.
4. **Negative-knowledge expiry.** Let a negative-knowledge item carry an optional `revisit_when` (a commit, a date, or a condition) so "do not re-add X" can be re-reviewed instead of silently outliving its reason.
5. **Reference liveness.** Resolve PR/ticket state (`gh pr view`, tracker API) and stale internal doc links during `--repo`, so a "see PR 812 (draft)" claim flags when 812 has merged or closed.
6. **Provenance/signing.** Sign the doc (or at least its negative-knowledge block) so a receiver can authenticate the author — negative knowledge is the most dangerous content to forge and is currently unauthenticated.
7. **Protocol-version migration.** Ship a converter and a compatibility window so an older `protocol_version` degrades gracefully instead of failing outright.

## The invariant to hold

Every enforcement above exists to protect the §0 sentence: a cold agent, given
only the artifact plus repo access, reaches the same decisions the sender would.
Freshness is not a property of the doc — it is a property of the doc *relative to
HEAD*. So the durable lesson: **check at consumption time, against the current
tree, not just at authoring time.** Authoring-time checks (the structure score)
keep a doc well-built; only consumption-time checks (`--repo`/`--verify` run by
the receiver) keep it true.
