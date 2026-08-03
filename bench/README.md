# Handover bench

Measures whether a handoff artifact actually *transfers* context — not whether it is
well-formatted (lint already does that).

## The two layers

**1. Deterministic (runs now, `node bench/run.js`).** For each scenario, every planted
trap has a `guard_pattern`; the layer reports **trap coverage** — does the artifact carry
the negative knowledge that would steer a cold agent away from that trap? Plus the lint
score. Same input, same numbers.

Honest limit: this layer checks that the *warning is present in the text*, not that an
agent obeys it. It is a necessary-condition check — an artifact that never mentions the
reverted feature cannot possibly protect a cold agent from re-adding it.

**2. Empirical (agent-in-the-loop, pluggable).** The sufficient-condition check. The
contract for a runner:

1. Materialize the scenario's repo state in a throwaway workspace.
2. Give a cold agent ONLY the artifact under test (or nothing, for the control) plus the
   workspace, with the scenario's task prompt.
3. Let it work to completion.
4. Run each trap's `detect_fell_in` command against the resulting workspace; a non-empty
   result means the agent fell into that trap.
5. Report traps fallen into per artifact: good doc vs bad doc vs no doc.

No runner is bundled, deliberately: the enforcement paths of this repo stay LLM-free, and
a runner is by definition agent-specific. Any harness that can spawn a fresh agent in a
directory can implement the five steps above. `bench/scenarios/reverted-feature/repo/` is
a real, working example of step 1 — a materialized fixture, not just an abstract premise —
that a `reverted-feature` trial has actually been run against (see `docs/PAPER_RELEASE_TRAIN.md`
for the results and, more importantly, two real methodology bugs the process caught).

## Hard lessons from actually running the empirical layer once

Both found by adversarial review of a real trial, not by inspection beforehand — worth
stating as rules, not just fixing quietly:

- **Negative knowledge must live ONLY in the artifact under test — never in the fixture's
  own source comments, and never in the task prompt an agent is given.** A fixture file
  that explains *why* not to do the trap (`// do not add a client-side total — see the
  handoff doc`) hands the answer to every condition equally, including the no-artifact
  control. So does a task prompt that specifies the correct step order for an
  ambiguous-next-action trap. If the fixture or the prompt already tells the agent what
  not to do, the trial measures nothing.
- **For an `ambiguous-next-action` trap, make the correct order matter mechanically, not
  just documentarily.** A comment saying "apply the migration first" is advice a probe
  can't verify happened for a real reason. A dependency that actually throws when skipped
  (`bench/scenarios/reverted-feature/repo/src/lib/guestOrdersStore.ts` refuses writes
  until `migrations/applied.json` exists) gives the trap a real consequence and the probe
  something concrete to check.
- **A `detect_fell_in` probe keyed to specific literal identifiers will miss the same
  violation expressed a different way.** The reverted-feature trap-1 probe originally
  grepped for `computeTotalClientSide`/`clientTotal`; a real trial fell into the trap by
  importing the existing `computeOrderTotalServerSide` straight into frontend code
  instead — same architectural violation, different name, missed by the probe. Prefer
  checking the *structural* signal (does this layer import/call that module at all) over
  guessing at names an agent might use.

## Authoring a scenario

A scenario is `bench/scenarios/<name>/` with:

- `traps.json` — `scenario`, `premise`, and `traps[]`, each trap carrying `id`, `kind`
  (one of the §2b negative-knowledge categories or `ambiguous-next-action`), a
  `description` of the real failure, a `guard_pattern` (case-insensitive regex), and a
  `detect_fell_in` shell probe for the empirical layer.
- `good.handover.md` — a protocol-compliant handoff that carries the negative knowledge.
- `bad.handover.md` — the realistic failure case: the naive "session notes" summary an
  agent actually writes when nothing enforces the format.

**Author the traps first, from a failure you have actually seen — then write the good
artifact against them.** Never write the artifact first and derive `guard_pattern` from
its phrasing; that reverses the direction of evidence and turns the bench into a
self-fulfilling regex. Write `guard_pattern` with alternations for the different ways a
competent author would state the warning, and keep `bad.handover.md` honest: it should be
a *plausible* summary, not a strawman of random text.
