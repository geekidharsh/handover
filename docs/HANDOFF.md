---
protocol_version: 1
handoff: handover-oss-launch
author: Harshvardhan Pandey
iso_date: 2026-08-04
true_at_sha: ead2df33667e
shape: handoff
supersedes: handover-oss-readiness (2026-08-02, true_at acee245625de, superseded by publish + launch)
first_action: Run ./test/run.sh from the repo root and confirm "37 passed, 0 failed"; that is the gate before any step in section 6.
verify_cmd: ./test/run.sh
status: in_progress
---

# Handover: Handover (0.4.0 shipped, public, launch in progress)

**Read this first. It is self-contained.** You should not need anything outside this file plus repo access to continue. It supersedes the `handover-oss-readiness` handoff (pre-publish) that used to be canonical here.

## 0. Orientation (one paragraph)
Handover is an enforced agent-to-agent handover document (a strict validated header plus a prose body) with deterministic zero-dependency Node tooling: `handover-lint` scores a doc 0–100 and verifies it against the live repo, `handover-scaffold` fills the header from git, and `bench/run.js` measures whether a handoff actually transfers via planted traps. **Since the last handoff, the project actually shipped and launch is underway.** `geekidharsh/handover` is public (tag `v0.4.0`, CI green), the arXiv paper (`paper/handover.html`/`.pdf`, 8pp) is finished with two independent reviews' fixes applied, and the Claude Code community-marketplace plugin submission is in for review. What's NOT done: the arXiv submission itself is **blocked on endorsement** (see §6). **Zenodo is now done**, DOI `10.5281/zenodo.21797944` minted off release `v0.4.1`, badged in README, in `CITATION.cff`. OSF Preprints submission is in progress (owner-gated, hit a UI paste/validation bug, see §5). TechRxiv was investigated and **excluded** (their policy explicitly rejects AI-assisted content, see §5). JOSS is gated until ~2027-02-03 (6-month public-history requirement). Remaining channels not yet executed: `awesome-claude-code`, Show HN, Reddit, ClawHub. Full venue-by-venue status: [PUBLICATION_VENUES.md](PUBLICATION_VENUES.md). This repo (`handover-lab`, private, renamed from `handover` on 2026-08-02) is the working copy; edit here first, always. The public repo is kept in sync by copying specific files across (paper, plugin manifest), never edited independently; it has its own local clone at `~/Github-repos/handover`.

## 1. Identity (verify each; do not trust blindly)
| Fact | Value | Verify |
|---|---|---|
| Branch | `dev` | `git rev-parse --abbrev-ref HEAD` |
| True at commit | `ead2df33667e` | `git log ead2df33667e..HEAD --oneline` (drift if non-empty) |
| Plugin version | `0.4.0` (package/CITATION bumped to `0.4.1` for Zenodo archival only, protocol/plugin unchanged) | `grep version .claude-plugin/plugin.json` |
| Protocol version | `1` (unchanged since 0.4.0) | `grep CURRENT_PROTOCOL_VERSION bin/lib/handover-doc.js` |
| Tests | 37 checks, 0 failures | `./test/run.sh` |
| Public repo | `github.com/geekidharsh/handover`, PUBLIC, tag `v0.4.1` | `gh repo view geekidharsh/handover --json visibility` |
| Zenodo DOI | `10.5281/zenodo.21797944` (archived off `v0.4.1`) | `zenodo.org/account/settings/github/repository/geekidharsh/handover` |
| Local clones | `handover-lab` (this one, private working copy) + `handover` (public, separate clone, sibling directory) | `ls ~/Github-repos \| grep -i handover` |

## 2. Current state as verifiable claims
| Claim | Verify |
|---|---|
| Full suite passes | `./test/run.sh` |
| Repo-verification suite passes (21 checks) | `bash test/verify.test.sh` |
| The git pre-commit hook suite passes, including fail-open | `bash test/hook.test.sh` |
| Three bench scenarios exist, not one | `ls bench/scenarios` |
| `--claims` cannot execute a table inside a code fence | `grep -n maskBody bin/handover-lint.js` |
| No private-repo references remain in shipping files | `! grep -riq ideas-folder README.md PROTOCOL.md CHANGELOG.md docs/ARCHIVE.md` |
| Public repo is a byte-identical mirror of this repo's paper | `diff paper/handover.html ~/Github-repos/handover/paper/handover.html` |
| `.claude-plugin/marketplace.json` passes strict validation | `claude plugin validate . --strict` |
| Claude Code community-marketplace submission was filed | `[belief, unverified]`, submitted via `platform.claude.com/plugins/submit` 2026-08-02, confirmation screen said "Plugin submitted for review"; no programmatic status check found |
| arXiv account `geekidharsh` exists and is verified | `[belief, unverified]`; no CLI-checkable state; verify at arxiv.org login |

## 3. Canonical sources (ranked; when they disagree, higher wins; code is truth)
1. This file, for status and the next action.
2. [README.md](README.md) (the docs router), for topic → authoritative doc → code path.
3. [RELEASE.md](RELEASE.md) for the gated publish checklist (all gates done except full launch); [ARXIV_SUBMISSION.md](ARXIV_SUBMISSION.md) for the paper submission package + endorsement plan; [PUBLICATION_VENUES.md](PUBLICATION_VENUES.md) for status across every venue (Zenodo/arXiv/OSF/JOSS/TechRxiv), not just arXiv; [IDENTITY_AND_LINKS.md](IDENTITY_AND_LINKS.md) for this project's locked identity decisions (canonical cross-project copy: `ideas-folder/IDENTITY_AND_LINKS.md`); [PORTING.md](PORTING.md) for non-Claude-Code use.
4. [PROTOCOL.md](../PROTOCOL.md) for the format and rubric; [SECURITY.md](SECURITY.md) for the threat model; [STALENESS.md](STALENESS.md) for the enforcement roadmap.
5. The tests, for the contract the code actually meets.

## 4. What changed since the last handoff (do not rebuild these)
- **Published.** Squash-published to `geekidharsh/handover`, made public, tag `v0.4.0`, GitHub Release cut, CI green. Do not re-run the history scrub.
- **Local repo split.** `~/Github-repos/handover` → renamed to `~/Github-repos/handover-lab` (matches the GitHub rename); the public repo got its own fresh clone at the now-free `~/Github-repos/handover` path. Both are real, independent local git repos. Do not assume they're the same checkout.
- **Paper finished, twice-reviewed.** Two independent adversarial reviews applied (originality/quality pass, then a second pass with fresh reviewer persona finding 3 must-fix + 4 should-fix issues, trap-taxonomy circularity, missing empirical config, an unsupported universal claim in the intro, AgentDojo citation added, etc.). Byline now has name, brownlittlefish.com, repo link, and a contact email (`harshvardhanpandey@hotmail.com`, **paper only, deliberately not in NOTICE/README/CITATION.cff**). Do not re-litigate these fixes without new findings.
- **Identity decisions locked** (see [IDENTITY_AND_LINKS.md](IDENTITY_AND_LINKS.md)): affiliation "Independent," website brownlittlefish.com, LinkedIn/X for social only, git commit-author email stays `harshvardhanpandey@hotmail.com` (a rewrite to `harsh@household.dev` was considered and explicitly rejected, Handover isn't a household.dev room). Canonical copy of this identity file lives in `ideas-folder`, not duplicated per-project.
- **Claude Code plugin marketplace: submitted.** Community-marketplace review (not the curated official one), 2026-08-02. `marketplace.json` had a real bug fixed first (missing top-level `description`, caught by `claude plugin validate`).
- **arXiv: registered and mid-submission, blocked on endorsement.** See §6, do not restart the account/registration flow, it's done.
- **Zenodo: done.** GitHub-integration toggle flipped on, release `v0.4.1` cut specifically for archival (version bump only, no functional changes), DOI `10.5281/zenodo.21797944` minted automatically, badge added to README, identifier added to `CITATION.cff`. Do not cut another release for this, it's closed.
- **Publication venues fully surveyed, not just arXiv.** OSF Preprints package prepared (see [PUBLICATION_VENUES.md](PUBLICATION_VENUES.md)), submission in progress but hit a UI bug (Next button unresponsive on step 1 even with valid title/abstract, likely a paste-doesn't-fire-validation issue; workaround is to type/delete a character in each field after pasting to force a change event). TechRxiv was investigated and **excluded**: their submission policy explicitly rejects content that used AI assistance to create, and this paper's own process (agent-drafted sections, agent-run adversarial reviews) matches that criterion directly, not a marginal risk. JOSS is gated until ~2027-02-03 (6 months of public dev history, plus real evidence of research usage, not just the clock).
- **GitHub/Stack Overflow profile audit, closed.** Checked whether anything else in the owner's public profile could unlock a venue gate. Found nothing that changes anything: 429 "merged PRs outside geekidharsh/*" all turned out to be private company repos (`shalini-kshama/{Carbro,Nanimaa,Poppy}`), not third-party OSS, do not cite that count as external contribution credit. Stack Overflow account is real (3,609 rep) but topically unrelated. Full detail in [PUBLICATION_VENUES.md](PUBLICATION_VENUES.md).

## 5. Negative knowledge (the irreducible core, if you must cut length, cut this last)
- **Tried and failed:** the first cut of `--claims` extracted commands from **raw** document lines and armed any table whose last column merely *contained* "verif". Adversarial review proved two working command-execution escapes (a table inside a code fence; a "Verified By" roster column). The working approach is fence-**masked** lines plus an **exact** header match. Full write-up: SECURITY.md finding 4.
- **Tried and failed (0.3.0, still true):** building `--repo` git calls by string-interpolating `true_at_sha` into a shell command, a command-injection hole. All git probes stay shell-free via `execFileSync`.
- **Tried and failed (2026-08-02, arXiv submission):** started the submission with `cs.SE` as primary category / `cs.AI` as cross-list (matches the closest-sibling paper, SWE Context Bench's own classification, and the paper's actual contribution, protocol/tooling/benchmark, not an AI technique). Mid-submission the category got changed live to **`cs.AI` primary / `cs.SE` cross-list** instead. Both are defensible; this is what was actually filed, don't silently revert to the original plan when picking this back up, and update `README.md`/`CITATION.cff` with whichever primary category the announced paper actually carries once it's live.
- **Tried and failed (2026-08-02, arXiv endorsement):** the `uis.edu` institutional-email shortcut for endorsement was tried first, dead, no longer accessible. Don't route through it. Real endorsement code for `cs.AI` (`B8G7VE`, cs.SE may need its own separate one) was requested and sent to `help@arxiv.org` since no personal contact with an existing arXiv account was available. Full plan + draft emails in [ARXIV_SUBMISSION.md](ARXIV_SUBMISSION.md).
- **Tried and failed (2026-08-02, local rename):** renaming `~/Github-repos/handover` → `handover-lab` broke Freeway's zone recognition for the new path (a write was denied). Fixed correctly by proposing the zone (`freeway zone propose`) and waiting for human approval + a separate `freeway zone ratify` step, **`ratify` is a real, separate step after `approve`, not automatic; also discovered `zone ratify` has no per-request scoping, it promotes the entire staged batch.** Do not route around a Freeway denial by finding another tool path, propose and wait. Logged as real CLI gaps in `agent-freeway-lab/ISSUES.md` (Z-78 through Z-81).
- **Tried and failed (2026-08-02, git hygiene):** committed a fix to `agent-freeway-lab` while accidentally on a stale, already-merged branch (`audit/governance-2026-07-23`) instead of `main`, always run `git branch --show-current` before committing in an unfamiliar/reused checkout, don't assume the last-known branch is still current.
- **Tried and failed (2026-08-04, OSF Preprints submission):** the generic "OSF" branch (the only content-appropriate one; the visible "Select A Preprint Service" picker only lists discipline partners like PsyArXiv/EdArXiv/Law Archive/etc., none of which fit a CS/software paper) is only reachable via the direct URL `osf.io/preprints/osf/submit`, not the picker UI. On that path, step 1's Next button did nothing after pasting title+abstract; no error, not greyed out. Root-caused as a likely paste-vs-framework-validation gap (common in JS form wizards: paste doesn't always fire the same event a keystroke does). Fix: after pasting, click into the field and add/delete one character to force a real change event.
- **Deliberately out of scope / not built:** the empirical bench runner staying agent-in-the-loop by design (documented in `bench/README.md`); drift-to-claim mapping; negative-knowledge expiry; PR/ticket liveness; provenance/signing. On the STALENESS roadmap, not forgotten. Also: an MCP-server wrapper for lint/scaffold/bench, considered for discoverability (MCP registries), explicitly out of scope for this launch, real scope not a listing action.
- **Decisions + rationale:** the core validator (`handover-doc.js`) stays pure and deterministic. `--claims` implies `--verify`. The git pre-commit hook deliberately does **not** pass `--verify`/`--claims`. Patent: decided not to file (recorded in `docs/RELEASE.md` Gate 0, do not re-litigate without new information).

## 6. Next action
1. **Run `./test/run.sh` and confirm `37 passed, 0 failed`** (mirror of the header `first_action`).
2. **Owner-gated, in progress:** finish the arXiv submission. Endorsement request sent 2026-08-02 (code `B8G7VE`, `cs.AI`) has passed arXiv Support's typical same-day turnaround with no reply as of 2026-08-04, a follow-up in the same thread is warranted, not a new email. If `cs.SE` cross-list also prompts for its own endorsement, capture that code too. A cold-contact backup email to a cited author (SWE Context Bench recommended) is drafted and ready in [ARXIV_SUBMISSION.md](ARXIV_SUBMISSION.md) if Support stays slow.
3. **Owner-gated, in progress:** finish the OSF Preprints submission, package ready in [PUBLICATION_VENUES.md](PUBLICATION_VENUES.md), currently blocked on the step-1 Next-button bug documented in §5. Retry with the paste-then-nudge-a-character workaround.
4. Once arXiv clears: update `README.md` citation section + `CITATION.cff` with the real `arXiv:26XX.XXXXX` ID and whichever category (`cs.AI` primary, per §5) actually got announced.
5. Remaining launch channels, not yet started, roughly in this order: `awesome-claude-code` (owner must submit, their policy says humans only, not agents), Show HN (best once arXiv is live, one shot), Reddit (r/ClaudeAI, r/AI_Agents), X thread (`@brownlittlefish`). Medium/Substack companion writeup is done (`brownlittlefish.substack.com/p/handover-a-machine-checkable-protocol`). Full detail in [PUBLICATION_VENUES.md](PUBLICATION_VENUES.md).

## 7. Open questions / blocked on user
- Does `cs.SE` need its own separate endorsement code, or did `cs.AI`'s endorsement cover both? Unknown until the form is revisited post-endorsement.
- Has the OSF Preprints submission actually completed? Unknown as of this handoff, was still stuck on the step-1 bug.
- Should the behavioral gate be extracted to its own repo? Still deferred; the README's Scope section explains the split instead.
- ClawHub / SKILL.md authoring, worth doing, not started; no urgency assigned yet.

## 8. Verify the whole thing still holds
```
./test/run.sh
```
