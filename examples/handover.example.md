---
protocol_version: 1
handoff: guest-checkout
author: Dana (STORE team)
iso_date: 2026-01-14
true_at_sha: a1b2c3d4e5f6
shape: handoff
supersedes: null
first_action: Run the pending migration on the preview database, then point the /api/guest-order route at the new table (see section 6, step 1).
verify_cmd: npm test -- guest-checkout && npm run typecheck
status: in_progress
---

# Handover: guest checkout

**Read this first. It is self-contained.** You should not need anything outside this file plus repo access to continue this work.

## 0. Orientation (one paragraph)
We are adding a guest checkout path so buyers can complete an order without creating an account. The database layer and the order-total logic are done and tested; the HTTP route that ties them together is stubbed but not wired. This document tells you exactly what is true, what to verify, and what to do next.

## 1. Identity (verify each; do not trust blindly)
| Fact | Value | Verify |
|---|---|---|
| Branch | `feature/guest-checkout` | `git rev-parse --abbrev-ref HEAD` |
| True at commit | `a1b2c3d4e5f6` | `git log a1b2c3d4e5f6..HEAD --oneline` (empty means nothing drifted) |
| Open PR | https://github.com/acme/store/pull/812 (draft) | `gh pr view 812` |
| Worktree? | no | n/a |
| Tickets | STORE-441, STORE-442 in progress | `grep -n 'In progress' TASKS.md` |

## 2. Current state as verifiable claims
| Claim | Verify |
|---|---|
| `guest_orders` table migration exists but has not been applied to preview | `ls migrations/ | grep guest_orders` |
| Order-total logic handles guest tax the same as member tax | `npm test -- order-total` |
| The `/api/guest-order` route returns a hardcoded stub | `grep -n 'STUB' src/routes/guestOrder.ts` |
| Rate limiting on the route | `[belief, unverified]` — not yet added, confirm before launch |

## 3. Canonical sources (ranked; when they disagree, higher wins; code is truth)
1. This file, for current status and the next action.
2. `docs/CHECKOUT_SPEC.md`, for the intended behavior. Its section on saved payment methods is out of date since we descoped that (see section 4).
3. The tests in `test/guest-checkout/`, for the contract the code actually meets.

## 4. What changed since the spec was written (do not rebuild these)
- Saved payment methods were removed from scope. The spec still describes them; do not build them. They pulled in PCI storage requirements we are not taking on for launch.
- The guest email field was made required after a review found we had no way to send a receipt otherwise.

## 5. Negative knowledge (the irreducible core — if you must cut length, cut this last)
- **Tried and failed:** Reusing the member `Order` model directly for guest orders. It failed because the model requires a non-null `user_id` at the database level, and making it nullable broke three member-side queries. The guest path gets its own table instead.
- **Deliberately out of scope / not built:** Saved payment methods, and guest-to-member account merging. Both are post-launch.
- **Built then reverted, do NOT re-add:** A client-side order-total calculation was added for a snappier UI, then reverted. It let the browser disagree with the server on tax. Totals are server-authoritative only.
- **Decisions + rationale:** Separate `guest_orders` table rather than a nullable column on `orders`, because it keeps member queries unchanged and isolates the guest data for later cleanup.

## 6. Next action
1. **Run the pending migration on the preview database, then point the `/api/guest-order` route at the new table (replace the stub).** This is also the header `first_action`.
2. Add rate limiting to the route (the one unverified claim in section 2).
3. Flip PR 812 out of draft once `verify_cmd` passes.

## 7. Open questions / blocked on user
- Should a guest be offered account creation after a successful order, or on a later email? Product has not decided; do not build either path until they do.

## 8. Verify the whole thing still holds
```
npm test -- guest-checkout && npm run typecheck
```
