# Contributing to Handover

Thanks for looking at Handover. It is a small, deliberately conservative codebase; the
constraints below are the product, not incidental style.

## The invariants (non-negotiable)

1. **No LLM and no network call in any enforcement path.** Lint, gate, and bench are
   deterministic: same input, same result. A model may *author* a handoff; a model never
   *judges* one.
2. **Zero runtime dependencies.** Plain Node ≥ 18. If a change needs an npm package, the
   change is wrong for this repo.
3. **Fail-open.** A crashing hook or malformed policy must degrade to "Handover emits
   nothing" — never to blocking the user's work.
4. **Shell-free probes on untrusted input.** Anything read from a handoff document must
   never reach a shell. Only the user-opted `--verify` runs the doc's own `verify_cmd`,
   and that is documented as the same trust level as `make test`.

PRs that violate an invariant will be declined even if the feature is useful.

## Dev setup

There is no build step and nothing to install:

```bash
git clone https://github.com/geekidharsh/handover.git
cd handover
./test/run.sh        # full suite
node bench/run.js    # bench scenarios
```

## Making a change

- **Spec first.** If the change alters what a valid handoff *is*, update `PROTOCOL.md` in
  the same PR. The spec is authoritative; the code implements it.
- **Every behavior change lands with a test.** `test/run.sh` is the top-level suite;
  pure-rubric assertions go in `test/doc.test.js`, repo-aware checks in
  `test/verify.test.sh` (which builds a throwaway git repo).
- **Scoring changes are breaking-ish.** The 0–100 rubric is documented in `PROTOCOL.md`
  §6b; if you reweight it, update the docs, the example (which must keep scoring 100),
  and the CHANGELOG.
- **New bench scenarios are very welcome.** A scenario is a directory under
  `bench/scenarios/<name>/` with `traps.json` (the planted traps and their
  `guard_pattern` / `detect_fell_in`), plus `good.handover.md` and `bad.handover.md`.
  Author the traps from a real failure you have seen, *before* writing the good
  artifact — not by copying phrases out of it.

## Reporting bugs and security issues

- Bugs: open a GitHub issue with the doc (or a minimal repro) and the command you ran.
- Security: see [SECURITY.md](SECURITY.md). The threat model lives in
  [docs/SECURITY.md](docs/SECURITY.md); read it before reporting "lint can be gamed" —
  what the score does and does not claim is documented there.

## License

Apache-2.0. By contributing you agree your contribution is licensed the same way.
