# Current State

**As of:** 2026-09-30
**Canonical line:** `main` after `integration/lm-week-one` is promoted (see Branch disposition). Until then, `integration/lm-week-one` is the product truth and `main` (2026-08-27) is stale.

This page is the single current-status record. It replaces earlier audits and function inventories. When it disagrees with an older status document, this page wins; when it disagrees with Foundation or an accepted decision record, those win and this page must be corrected.

## What works today

Proven through automated tests and live, isolated Cloudflare staging with synthetic media (`docs/EXECUTION/WEEK_ONE_STAGING_EVIDENCE_2026-09-23.md`):

**Photo → real voice → durable originals → queued transcription → conversational Muse → optional spoken replies → storyteller-owned context → completion → reopen → original playback → bounded family share → revoke → delete.**

- Capture/import, contextual permissions, quality guidance with manual override, IndexedDB recovery, offline storytelling, ordered background sync.
- Immutable original photo and voice in private R2 with D1 receipts; byte-for-byte playback verified.
- Clerk email and Google sign-in, anonymous-draft promotion exactly once, session bridge, cross-device recovery.
- ElevenLabs Scribe v2 transcription behind a provider boundary; English and mixed Spanish/English verified live; provider failure retries from the preserved original without re-recording.
- Muse (Workers AI) asks one natural question at a time from the storyteller's own words, never resolves a detail by inference, and keeps its turns attributed separately; Muse questions can be spoken (ElevenLabs TTS) and answered by voice.
- Idempotent completion consumes the single free Living Memory exactly once; completed memories reopen.
- Voluntary, previewed, revocable family share exposing only selected fields; sharing never changes entitlement.
- Owner deletion of R2 media and connected D1 rows with a content-free deletion receipt; deletion does not restore free capacity.
- A / A+ / A++ text size; public Legacy Story Starter, `llms.txt`, OpenAPI, and MCP agent surface (ASC-01) with the private archive excluded.

## Release-candidate gate (not yet passed)

The product is **not** release-locked. Remaining, in order:

1. Re-run the real-phone journey on the repaired build (iPhone Safari and Android Chrome): Photo → Voice → Save to account → Muse → context → Preserve → Playback → Share → Delete → text size.
2. Packet 4 closeout on a real phone: email and Google sign-in and second-device recovery. Facebook sign-in is deferred and does not block (`docs/DECISIONS/2026-07-16-facebook-staging-deferral.md`).
3. Three uncoached human sessions, at least one in Spanish or mixed language, confirming people can tell their own testimony apart from Muse.
4. Fix any severe trust, comprehension, or accessibility defect found, then repeat the affected step.
5. Lock the release-candidate SHA and stop feature work on it.

After the RC lock, the production-ready-not-live hardening in `docs/EXECUTION/DEFINITION_OF_DONE_V1.md` remains: WCAG 2.2 AA review, threat model and security review, Turnstile/rate limits, secure headers, log redaction, retention and deletion-recovery policy (requires legal approval), observability and alerts, backup/rollback rehearsal, and legal wording. Production deployment itself requires separate owner authorization.

## Settled — do not reopen

| Question | Answer | Source |
| --- | --- | --- |
| Canonical product object | Living Memory. `MemoryStory` survives only as persistence names. | `DECISIONS/2026-08-11-living-memory-doctrine.md` |
| Share-to-unlock | Retired. One free Living Memory; sharing is voluntary and never rewarded. | same |
| Transcription provider | ElevenLabs Scribe v2 behind a replaceable boundary; Workers AI powers Muse text. | `DECISIONS/2026-09-22-elevenlabs-first-modular-provider-boundaries.md` |
| Muse behavior | Conversational elicitor; never judges, verifies, or invents. | `DECISIONS/2026-09-23-muse-conversational-story-elicitor.md`, `PRODUCT/STORYTELLER_SOVEREIGNTY.md` |
| Facebook sign-in | Deferred; email + Google are sufficient for the first release. | `DECISIONS/2026-07-16-facebook-staging-deferral.md` |
| Commerce | Not on the production line until the RC is locked; branches kept as reference. | this page |
| "Production v1" | Production-ready-not-live solo Living Memory. Public feed, direct social publishing, Memory Circle, billing are outside it. | `EXECUTION/DEFINITION_OF_DONE_V1.md` |

## Branch disposition

| Branch / PR | Content | Disposition |
| --- | --- | --- |
| `integration/lm-week-one` | Doctrine + Week-One product loop, all `agent/lm-week-a*` and `plan/*` branches | Promote to `main` |
| `packet-0` … `packet-3`, PRs #1, #2 | Contained in `main` | Close PRs, delete branches |
| `packet-4/account-binding-recovery`, `feat/asc-01-*`, PRs #3, #11 | Same tree as `main` (squash-promoted) | Close PR, delete branches |
| `agent/living-memory-doctrine`, PR #4 | Contained in `integration/lm-week-one` | Close PR as merged-by-promotion |
| `agent/lm-week-a1…a5`, `plan/living-memory-week-one` | Contained in `integration/lm-week-one` | Delete branches |
| `agent/living-memory-landing-*`, `agent/value-bearing-cleanup`, PRs #5–#7 | August landing redesign, predates the Week-One UI | Close PRs; keep branches as reference for the later landing slice |
| `agent/commerce-slice-a/b/c`, PRs #8–#10 | Stripe checkout and entitlement grants on the August base | Close PRs; keep branches as reference; rebuild on `main` after RC lock |
| `copy/four-part-persuasion`, PR #14 | Customer copy still using "Memory Story" and Good Karma edits | Close; harvest wording into the landing slice if wanted |
| `feat/functional-discovery-surface-01`, PR #13 | Ten family-story discovery pages, sitemap, IndexNow | Rebase on promoted `main` after RC lock; acquisition door only |
| `chore/known-outcome-engineering-v1` | CI contract checker | Decide: rebase onto `main` or drop |

Do not branch from anything except current `origin/main` after promotion.

## Known technical debt

- `share_events.unlock_granted` and its unique index (migration 0001) are inert; the runtime never writes them. `story_entitlements.free_stories_unlocked` is fixed at 1. Drop them only in a deliberate migration with product value.
- Trigger-heavy migrations 0001–0004 apply to remote D1 through `wrangler d1 execute --file`; the normal migration path rejects them (`incomplete input`). Later migrations apply normally.
- A staging client build must include `.env.staging.local`; otherwise the Clerk publishable key is missing from the browser bundle even though the Worker deploys.
- `wrangler.jsonc` intentionally carries a zero D1 ID; environments supply real IDs.
- `config/phase-1.ts` lists `facebook` in `supportedMethods` while Facebook sign-in is deferred.
- ElevenLabs `voices_read` permission is unavailable on the current key; a fixed voice ID is configured.

## Needs an owner decision

1. **Order after the RC lock.** Three documents disagree:
   - `FOUNDATION/08_BUILD_ORDER.md`: Family Archive → contributions → retrieval → Memory Circle → …
   - `EXECUTION/NEXT_PHASE_OUR_LIVING_LEGACY_AND_PHOTO_DIGITIZATION.md`: archival physical-photo capture → "Our Living Legacy" group video around one photograph.
   - The September audit: albums → Preserve Together → remote Memory Circle → Family Archive → feed → commerce → UGC.

   Recommendation: adopt the Next Phase document (capture quality first, then small group video), record it as a decision, and amend the build order through that decision.
2. **Naming of the group experience.** "Preserve Together", "Remember Together / Memory Circle" and "Our Living Legacy" describe overlapping ideas. Pick one customer name.
