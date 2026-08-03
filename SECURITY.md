# Security policy

Handover's full threat model — what the tooling defends against, known residual risks,
and the honest limits of a deterministic linter — lives in
[docs/SECURITY.md](docs/SECURITY.md).

## Reporting a vulnerability

Open a GitHub security advisory on this repository
(https://github.com/geekidharsh/handover/security/advisories/new), or open an issue if
the report is not sensitive.

Please include: the input document (or minimal repro), the exact command, observed vs.
expected behavior.

## Scope notes for reporters

- **The STRUCTURE score judges shape, not truth.** "I wrote a false doc that scores
  100/100" is documented behavior, not a vulnerability (see docs/SECURITY.md).
- **`--verify` intentionally executes the doc's own `verify_cmd` through a shell.** That
  is opt-in and documented as the same trust level as running `make test` in a repo you
  just cloned. A way to make *header fields or other doc content* reach a shell without
  `--verify` **is** a vulnerability — report it.
- Anything that makes a hook fail *closed* (blocking work when Handover crashes) is a
  bug we want to know about.
