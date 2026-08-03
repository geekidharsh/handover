# guest-checkout-demo

A materialized synthetic repository for the `reverted-feature` bench scenario. This is
**not** part of the Handover product — it's a small fixture repo that an agent-in-the-loop
trial runs against, so `bench`'s empirical layer (documented as pluggable in
`bench/README.md`) has something real to act on instead of an abstract premise.

**Do not edit this tree to make a specific trial pass.** It represents the repo state the
scenario's `traps.json` was written against; changing it invalidates every existing
`good.handover.md` / `bad.handover.md` claim and `detect_fell_in` probe.

To run a trial: copy this directory to a scratch location, `git init` and commit it fresh
(so the trial gets a clean, isolated history), then hand a cold agent either
`../good.handover.md`, `../bad.handover.md`, or nothing, plus the task prompt in
`../traps.json`'s `premise`, and let it work. Afterward, run each trap's `detect_fell_in`
against the resulting tree.
