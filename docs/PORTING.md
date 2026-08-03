# Using Handover outside Claude Code

Handover is two things stacked, and only the top one is Claude Code-specific:

| Layer | Files | Portable? |
|---|---|---|
| The document + spec | `PROTOCOL.md`, `templates/`, `examples/` | Plain markdown — fully portable |
| Lint / scaffold / bench | `bin/*.js`, `bench/` | Plain Node ≥18, zero dependencies — fully portable |
| Enforcement at a session boundary | `hooks/*.js`, `hooks/hooks.json` | Speaks the Claude Code hook protocol |
| Author-facing commands | `commands/*.md` | Claude Code slash commands |

So adopting Handover in another harness means keeping the first two layers as-is and
replacing the third.

## The minimum viable adoption (any agent, any repo, five minutes)

1. Put the CLI on PATH: clone this repo and `npm install -g .`, or call
   `node <checkout>/bin/handover-lint.js` directly.
2. Tell your agent where handoffs live and what shape they take. In an `AGENTS.md`,
   `CLAUDE.md`, `.cursorrules`, system prompt, or whatever your harness reads:

   > When ending a session, write a handoff to `Docs/HANDOVER_<workstream>_<ISO date>.md`
   > following `PROTOCOL.md`. Generate the header with
   > `handover-scaffold > <path>`, fill in every `FILL IN`, and verify with
   > `handover-lint <path> --repo --min=80` before you stop. When starting a session,
   > read the newest `Docs/HANDOVER_*.md` first and run
   > `handover-lint <path> --repo --claims` to see which of its claims still hold.

3. Install the git hook — this is the part that makes it stick without any harness
   integration at all:

   ```bash
   cp <checkout>/hooks/pre-commit.sample .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
   ```

   It validates any staged `HANDOVER_*.md` / `*.handover.md` and fails the commit on a
   malformed header, a fabricated SHA, or a score under `HANDOVER_MIN` (default 80). It
   fails *open* if Handover is not installed, and never executes anything out of the
   document being committed.

That gives you authoring guidance, consumption-time verification, and a real gate,
in any harness, with no plugin.

## Porting the session-boundary gate

If your harness has tool-call hooks, the header gate is the piece worth porting; it is
~40 lines. The contract:

- **Trigger:** after a write/edit whose target path matches `HANDOVER_*.md`.
- **Logic:** `require('bin/lib/handover-doc.js').evaluate(fileContents)`; if
  `result.valid` is false, block and return `result.headerErrors` — each error already
  carries the field name and the fix.
- **Fail open:** any exception in the hook must emit nothing. A crashing gate that blocks
  work is worse than no gate.

`hooks/handover-gate.js` is the reference implementation; read it and translate the I/O
shell, not the logic.

## CI enforcement

The same check as a pull-request gate, no harness involved:

```yaml
- run: npx handover-protocol handover-lint Docs/HANDOVER_current.md --repo --strict
```

Use `--strict` in CI so drift and an unproven `done` fail the build. Add `--claims` only
where you are comfortable executing the document's own commands — the same trust decision
as running that repo's test suite.

## What does not port, and why

The behavioral gate (`hooks/gate.js`, `hooks/loop.js`) is Claude Code-specific *and*
belongs to a different product (see the Scope section of the README). Do not port it as
part of adopting the handover document — they are separable concerns that happen to ship
in one repo today.
