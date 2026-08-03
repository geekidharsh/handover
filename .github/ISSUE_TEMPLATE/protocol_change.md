---
name: Protocol change / new rule
about: Propose a change to what a valid handoff is (PROTOCOL.md), a rubric reweight, or a new bench scenario
labels: protocol
---

**What you're proposing**

**Which invariant does it serve?** (§0: a cold agent, given only the artifact plus repo
access, reaches the same decisions the sender would.) Concretely: what does a receiver
have to re-derive today that this change would preserve?

**Is it deterministically checkable?** A rule that needs a model to judge it cannot be
enforced here — it can still live in PROTOCOL.md as guidance, but say which you mean.

**Real failure it came from** (a handoff that actually went wrong, ideally):

**If this is a bench scenario:** describe the traps *before* the artifact — the traps
must come from an observed failure, not be derived from the wording of a good doc.

**Backward compatibility:** do existing valid documents still validate?
