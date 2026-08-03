---
protocol_version: 1
handoff: httpclient-migration
author: Priya N.
iso_date: 2026-02-03
true_at_sha: 9f8e7d6c5b4a
shape: handoff
supersedes: null
first_action: Run `npm run lock:ci` to regenerate the CI lockfile BEFORE anything else — the test suite fails with a bogus TLS certificate error until this is done.
verify_cmd: npm run lock:ci && npm test -- httpclient
status: in_progress
---

# Handover: httpkit migration

**Read this first. It is self-contained.**

## 0. Orientation
Migrating the payments service from raw `fetch` wrappers to `httpkit`. Client wiring is done; auth-layer retry integration is in progress.

## 2. Current state as verifiable claims
| Claim | Verify |
|---|---|
| httpkit is pinned at 2.9.x | `grep '"httpkit"' package.json` |
| Auth layer uses httpkit retry hooks | `grep -rn 'onRetry' src/auth/` |

## 3. Canonical sources
1. This file. 2. `docs/HTTP_MIGRATION.md` (its v3 section is aspirational, see below).

## 4. What changed (do not rebuild)
- The fetch wrappers in `src/lib/http/` are already migrated; do not touch them again.

## 5. Negative knowledge (cut this last)
- **Tried and failed:** upgrading httpkit 2.9 → 3.x. v3 removed the retry hooks (`onRetry`) our auth layer depends on; the upgrade broke token refresh under load. Stay on 2.9 until the auth layer stops using hooks.
- **Do NOT delete `src/legacy-retry-shim.js`:** it has no static imports because it is dynamically required from `config/runtime.js`, so grep and dead-code tools call it unused. It is load-bearing on Windows; deleting it was done once and reverted after Windows CI broke.
- **Deliberately out of scope:** HTTP/2 support. Decided against it for this migration because the upstream proxy terminates HTTP/2 anyway.
- **Decisions + rationale:** we chose httpkit over axios because it is dependency-free and we ship in a sandboxed runtime; do not re-litigate.

## 6. Next action
1. **Run `npm run lock:ci` first (mirrors `first_action`). The TLS certificate error you get without it is misleading — it is a lockfile problem, not a TLS problem.**
2. Wire `src/auth/refresh.ts` to the shared client.
3. Delete the old wrapper exports once nothing imports them.

## 7. Open questions / blocked on user
- Do we need the sandbox exemption renewed before the next deploy window?

## 8. Verify the whole thing still holds
```
npm run lock:ci && npm test -- httpclient
```
