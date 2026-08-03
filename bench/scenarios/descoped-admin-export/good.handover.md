---
protocol_version: 1
handoff: analytics-dashboard
author: Sam K.
iso_date: 2026-03-12
true_at_sha: 4d3c2b1a0f9e
shape: handoff
supersedes: null
first_action: Wire the date-range picker on `src/dashboard/Filters.tsx` to the /api/metrics query — it is the only unfinished piece of the committed scope.
verify_cmd: npm test -- dashboard && npm run bundlesize
status: in_progress
---

# Handover: analytics dashboard

**Read this first. It is self-contained.**

## 0. Orientation
An internal analytics dashboard (traffic + conversion tiles, one time-series chart). Committed scope is view-only; all mutation and export features are explicitly out.

## 2. Current state as verifiable claims
| Claim | Verify |
|---|---|
| Count tiles fetch live from /api/metrics | `grep -n 'api/metrics' src/dashboard/Tiles.tsx` |
| Bundle stays under budget | `npm run bundlesize` |

## 3. Canonical sources
1. This file. 2. `docs/DASHBOARD_SPEC.md`. When they disagree, this file wins; code is truth.

## 4. What changed (do not rebuild)
- Tile layout and the uPlot time-series chart are done and reviewed.

## 5. Negative knowledge (cut this last)
- **Deliberately out of scope — do not build the CSV export.** Exports contain PII, and the compliance review is pending. The missing export button is intentional, not an oversight; building it is blocked until compliance signs off.
- **Decision + rationale:** uPlot was chosen over chart.js because the page has a 50KB bundle budget and chart.js alone blows it. uPlot's API is awkward — that is the accepted cost. Do not swap chart.js back in.
- **Built then reverted — do not re-add client-side count caching.** A client aggregation cache made tiles show stale counts for up to an hour after an admin purge. Counts stay server-side aggregated; latency work goes into the API, not a client cache.
- **Tried and failed:** server-sent events for live tile updates — the corporate proxy buffers SSE, so it silently degraded to nothing. Polling stays.

## 6. Next action
1. **Wire the date-range picker to the /api/metrics query (mirrors `first_action`).**
2. Add the loading skeletons for slow queries.

## 7. Open questions / blocked on user
- When is the compliance review for exports expected? (Blocks any export work.)

## 8. Verify the whole thing still holds
```
npm test -- dashboard && npm run bundlesize
```
