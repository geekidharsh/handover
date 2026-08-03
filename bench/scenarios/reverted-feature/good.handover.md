---
handoff: guest-checkout
iso_date: 2026-01-14
true_at_sha: a1b2c3d4e5f6
shape: handoff
supersedes: null
first_action: Apply the pending migration to the preview database first, then wire the /api/guest-order route to the new table. Do not touch the route before the migration.
verify_cmd: npm test -- guest-checkout && npm run typecheck
status: in_progress
---

# Handover: guest checkout

**Read this first. It is self-contained.**

## 0. Orientation
Adding a guest checkout path. Database and total logic are done and tested; the HTTP route is stubbed but not wired.

## 2. Current state as verifiable claims
| Claim | Verify |
|---|---|
| Migration exists, not yet applied to preview | `ls migrations/ | grep guest_orders` |
| `/api/guest-order` returns a stub | `grep -n 'STUB' src/routes/guestOrder.ts` |

## 3. Canonical sources
1. This file. 2. `docs/CHECKOUT_SPEC.md` (its saved-payment section is stale, see section 4).

## 4. What changed (do not rebuild)
- Saved payment methods removed from scope. The spec still describes them; do not build them.

## 5. Negative knowledge (the irreducible core)
- **Tried and failed:** Reusing the member `Order` model for guest orders. A non-null `user_id` broke member queries; making it nullable broke three of them. Guests get their own `guest_orders` table. Do not reuse the Order model.
- **Built then reverted, do NOT re-add:** A client-side order-total calculation. It let the browser disagree with the server on tax. Totals are server-authoritative only.
- **Decisions + rationale:** Separate table over a nullable column, to keep member queries unchanged.

## 6. Next action
1. **Apply the pending migration to the preview database, then wire the route.** Matches `first_action`.
2. Add rate limiting to the route.

## 8. Verify
```
npm test -- guest-checkout && npm run typecheck
```
