# Current State

**As of:** 2026-11-16
**Canonical line:** `main`. The Week-One product line (`integration/lm-week-one`) was promoted into `main` on 2026-09-30.

This page is the single current-status record. It replaces earlier audits and function inventories. When it disagrees with an older status document, this page wins; when it disagrees with Foundation or an accepted decision record, those win and this page must be corrected.

## RealtimeKit call slice — synthetic live-media proof

Owner-approved November 14 direction uses Cloudflare RealtimeKit managed calling. The call slice implements invitation-scoped, explicitly unrecorded two-person calling with opt-in microphone/camera, reconnect status, audio continuation and EN/ES controls. Joining stays separate from recording consent. Migration 0012 is required before deploying matching Worker/client; it has not been applied remotely.

Repository Actions credentials now work; no need to resend them or require guest Clerk accounts. The fixed staging app/restricted preset are configured. Read access run 43592575231, staging meeting/token API run 43593728473 and real-media browser run 43594590337 passed. The latter used two isolated Chromium contexts with synthetic app session/photo fixtures and real Cloudflare media: decoded video/nonzero audio/playback, camera-off audio, leave/rejoin, active guest removal and cleanup passed. See `IMPLEMENTATION/REALTIMEKIT_BROWSER_PROOF_2026-11-14.md` for exact scope. The application source is the reviewed PR #29 candidate; operational workflows are merged separately in PRs #30–#32.

Provider recording output run 43601378648 now passes for generated sources: simultaneous composite video and two exactly mapped audio sources, decoded media, hashes, durations and cleanup. This is provider evidence, not the family's permanent archive.

PR #36 merged as `87dab43` after CI 43607683913 passed (190 tests and 47 phone-browser checks). Consent-controlled recording/private archival originals now include independent agreements and either-person stop, persistent coordination/recovery, immutable composite and microphone-specific sources, private R2 read-back hash verification, partial-source states, own-voice claims, scoped replay/deletion and EN/ES controls. See `IMPLEMENTATION/REMOTE_RECORDING_ARCHIVE_2026-11-14.md`. Migration 0013 and the Durable Object migration are required before deploying matching code. Feature activation defaults off. PR #37 merged the actual-route/automatic-alarm integrated proof workflow and corrected full/ranged source response handling. Its first real run 43609943002 stopped at a nested-checkout module-root error before recording; provider cleanup was confirmed. PR #38 fixed the nested checkout path. Corrected real run 43610597090 passed actual consent/start/guest stop, automatic recording/ingestion, private full/ranged playback, independent source hashes and decoded nonzero audio with provider/native cleanup. Its storage was ephemeral native D1/R2. The owner then added a separate archive token; metadata access run 43626942755 passed. PR #39 merged after CI passed 201 tests and 47 phone checks. Real-cloud run 43628170649 then passed all three private originals/receipts, independent hashes, private full/ranged replay, nonzero decoded audio/video and persistence after a verified new Worker deployment. Provider and synthetic Worker/D1/R2 cleanup were confirmed. See `IMPLEMENTATION/REALTIMEKIT_CLOUD_ARCHIVE_PROOF_2026-11-14.md`. Implementation has advanced through Chapters, people and scoped invitations; current contribution work is described below. Deferred device/human and release gates remain open.

No application deployment, physical-phone/cross-region acceptance, full-application hosted identity/device acceptance or completed MVP v0.5 is claimed. Direct workspace credentials remain absent; existing RealtimeKit Actions secrets work and must not be requested again.

## Private Chapters and human people references

E01 merged through PR #40 (`5519350`) with clean-install CI 43633691702 (211 unit/integration tests and 49 phone checks). PR #41 (`2d226f5`, CI 43634182315) extends the isolated-cloud proof; real run **43634180628 passed**, including guest denial, Chapter retry/removal with unchanged recording originals, private playback, redeployment persistence and confirmed provider/storage cleanup. Apply migration 0014 before matching deployment. See `IMPLEMENTATION/PRIVATE_CHAPTERS_2026-11-14.md`.

E02 on `feat/human-entered-people` adds optional human-entered people, uncertainty/date wording, owned-memory references, separately attributed relationship statements and reversible links. Source media remains immutable; removed people retain attributed history and can be explicitly restored. Six route tests, native workerd/D1/R2 correction/history checks, malformed-success protection and both EN/ES phone journeys passed; all 51 phone-browser checks passed. PR #42 merged as `a0c4500` after CI 43635510632 passed all 218 unit/integration and 51 phone checks. Migration 0015 is required. See `IMPLEMENTATION/HUMAN_PEOPLE_REFERENCES_2026-11-14.md`. Roles/invitations, contributions and remaining V2 groups remain required; no complete release or full staging application deployment is claimed.

## Scoped family invitations — merged; hosted identity pending

E03 on `feat/scoped-family-invitations` adds verified-recipient expiring invitations, viewer/contributor roles, default selected-memory scope, explicit Chapter/archive-of-Chapter-memories scope, private original playback and revocation checks on every subsequent read. Copy-link delivery does not require a new messaging provider, and legacy conversation guests still need no account. Local core evidence is 226 tests/77 schema objects and all 53 phone-browser checks passed. PR #43 merged as `9d18404` after CI 43689344069 passed all 226 core and 53 phone checks. Hosted Clerk acceptance remains pending. Migration 0016 is required. Contributor roles are an authorization foundation; E04 separately attributed contributions remain next. See `IMPLEMENTATION/SCOPED_FAMILY_INVITATIONS_2026-11-15.md`. No full staging or production deployment is claimed.

## Family contribution text — merged; voice/photo sources pending

E04a on `feat/attributed-family-contributions` adds independently attributed human text, immutable revision lineage and versioned review intent, author-only revision/withdrawal, owner selection of a specific family-visible version, source-grant rechecks and recoverable on-device writing. Two EN/ES browser journeys, ten route cases, native D1/R2 source/receipt/lineage checks and draft cleanup/API boundary checks passed. Local core passed 238 tests with 88 schema objects and all 55 phone-browser checks passed. PR #44 merged as `d0a550b` after main CI 43692868082 passed. Migration 0017 is required. This is text only; E04 voice/photo sources and each author's transcript review remain required. See `IMPLEMENTATION/ATTRIBUTED_FAMILY_TEXT_2026-11-15.md`.

## Scheduled integrity checks — implemented locally; CI pending

A daily scheduled pass re-hashes stored originals and sources against the hashes recorded at preservation, never-checked first. It records each match, mismatch or missing object in the append-only `fixity_checks` table (migration 0025) and never repairs or rewrites anything. Deleting a memory removes its rows. See `IMPLEMENTATION/FIXITY_CHECKS_2026-11-16.md`.

## Dependency advisories and CI audit — merged

React Router, Vite and Vitest are updated past their advisories, and CI now fails on any high or critical advisory in shipped dependencies. One moderate advisory in RealtimeKit's `uuid` is accepted with its reason (PR #62, `cd865a0`). See `SECURITY/DEPENDENCY_ADVISORIES.md`.

## Export verification — merged

On the archive page, a person can check a saved archive or album export on their own device: every file is re-hashed against the export's manifest, and changed, missing and added files are named. Nothing is uploaded. No migration (PR #61, `c65a95a`). See `IMPLEMENTATION/EXPORT_VERIFICATION_2026-11-16.md`.

## Request-rate limiting — merged

Routes reachable without an account and routes that spend model or call budget now have per-address limits through three Workers Rate Limiting bindings. A missing or failing limiter lets the request through, so a counter outage never stops someone saving a memory. Thresholds need staging evidence. No migration (PR #60, `94518a2`). See `IMPLEMENTATION/RATE_LIMITING_2026-11-16.md`.

## Album export — merged

An owner can export one album or one Chapter as a verified ZIP that opens without the app, on any plan. It carries only recollections the owner shows family and names what it leaves out. No migration (PR #59, `cb550d4`). See `IMPLEMENTATION/ALBUM_EXPORT_2026-11-16.md`.

## Person albums — merged

Each named person has an album of the memories a human linked to them; people with the same name stay separate and nothing is added by face or voice recognition. Owner only; no migration (PR #58, `bc39ce7`). See `IMPLEMENTATION/PERSON_ALBUMS_2026-11-16.md`.

## Security headers and Worker error fallback — merged

The app shell and static files now carry baseline security headers with a report-only Content-Security-Policy; share pages and share media carry `noindex` and `no-referrer`; an unexpected Worker error returns a stable `503` code with nothing private (PR #57, `9211e22`). See `IMPLEMENTATION/SECURITY_HEADERS_AND_FALLBACK_2026-11-16.md`.

## Parallel lane scaffolding — merged

The coordinator added lane status files, per-lane copy catalogs and a shared private-media response used by all seven private media handlers, which also fixes the out-of-range `206` finding (F6). No behaviour change otherwise (PR #56, `38031c5`). See `IMPLEMENTATION/PARALLEL_LANE_SCAFFOLDING_2026-11-16.md` and `EXECUTION/V1_LAUNCH_PARALLEL_HANDOFF_2026-11-16.md`.

## Album permission for invited relatives — merged; hosted and human acceptance pending

The owner can let one accepted invited person make their own albums and Chapters from the memories shared with them. Those albums stay in the owner's archive, marked as made by a family member; the relative cannot reach albums made by the owner or anyone else, place a memory outside their invitation, or rename a memory. Removing the permission or the invitation stops them at once. Migration 0021 is required. PR #54 merged as `d0b5fa1` after CI 43784546004 passed. A relative's upload creating a new Living Memory is not built and needs an owner decision. See `IMPLEMENTATION/FAMILY_ALBUM_PERMISSION_2026-11-16.md`. The dated handoff for the next implementer is `EXECUTION/V3_AUTONOMOUS_ENGINEERING_HANDOFF_2026-11-16.md`.

## Albums that hold Chapters — owner decision accepted; wording merged

On 2026-11-15 the owner decided that the family archive is organized as Album → Chapter → Living Memory, that an invited relative may be given permission to organize albums at the owner's discretion, that reminders and invitations go by Cloudflare Email to both owner and invited family, and that album export is available to basic and premium alike. See `DECISIONS/2026-11-15-albums-reminders-export-tiers.md`. The container that already held Chapters is now labelled Album, with starter name ideas; no data or route changed (PR #53, `0be3408`, CI 43755292566). Person albums, album export and email remain to be built. See `IMPLEMENTATION/ALBUMS_AND_CHAPTERS_2026-11-15.md`.

## Portable archive export — plain export and conversation recordings merged

F01a lets the owner export a ZIP of their archive built on their device: every original is downloaded, re-hashed and compared with the preserved original before it is packaged, alongside a hash manifest and a readable index. Transcripts, storyteller context with history, the Muse conversation, family contributions, Chapters and people are included, with human, machine and Muse material labelled separately. The export states what it does not include and is marked incomplete whenever anything is missing; withdrawn recollections are left out. PR #50 merged as `25e3dd5` after CI 43727242307 passed. F01b (PR #52, `a9b2268`, CI 43754556216) adds Our Living Legacy recordings with participants, consent history, the consent in force at each recording and self-identified speakers only. No migration. Restore, encryption and server-built export for large archives remain. See `IMPLEMENTATION/PORTABLE_ARCHIVE_EXPORT_2026-11-15.md`.

## Timeline — merged; device and human acceptance pending

E06a gives the owner a timeline ordered by the year the storyteller named, showing their own words and keeping approximate, year-less and unknown dates as such; nothing is inferred or placed on a date they did not give. No migration. PR #49 merged as `344a96f` after CI 43726079674 passed. Opt-in resurfacing is not built and needs an owner decision on channel and cadence. See `IMPLEMENTATION/STORYTELLER_TIMELINE_2026-11-15.md`.

## Authorized search — merged; device and human acceptance pending

E05a adds literal, accent-insensitive search over human-entered words. The owner searches memory names, Chapters, named people, the storyteller's current context, recollections and speaker-written words; invited family searches only inside their invitation and only names plus owner-included words. Every match names its source and keeps "approximately". Revocation, scope changes and deletion apply on the next search. No migration, model or vector store. PR #48 merged as `d71d181` after CI 43725506954 passed. See `IMPLEMENTATION/AUTHORIZED_FAMILY_SEARCH_2026-11-15.md`.

## Speaker's written words for a voice recollection — merged; device and human acceptance pending

E04d lets the person who recorded a voice recollection write and revise the words they said. Every version is kept; only the speaker writes; invited family sees only the version the owner includes, beside an included voice. Excluding or withdrawing the voice clears it. No machine transcript of a contributor's voice is made: that needs an approved consent wording first. PR #47 merged as `3106d9d` after CI 43700841112 passed. Migration 0020 is required. See `IMPLEMENTATION/SPEAKER_WRITTEN_WORDS_2026-11-15.md`.

## Supplementary family photographs — merged; device and human acceptance pending

E04c lets an owner or invited contributor add their own photograph (for example the back of a print) as an immutable, separately attributed contribution that never replaces the memory's original. It reuses the voice path: private R2 original confirmed by read-back hash before any record exists, owner review before invited family sees it, withdrawal, no in-place revision, and removal with the memory. PR #46 merged as `8d03ab0` after CI 43699777117 passed. Migration 0019 is required. See `IMPLEMENTATION/ATTRIBUTED_FAMILY_PHOTO_2026-11-15.md`.

## Family voice recollections — merged; device and human acceptance pending

E04b adds a relative's own recorded voice as an immutable, separately attributed contribution: private R2 original confirmed by read-back hash before any record exists, owner review before invited family can hear it, author withdrawal, no in-place revision, and removal of every voice object on whole-memory deletion. Text and voice share the existing review flow through a read-only view. PR #45 merged as `a9cc1c7` after CI 43698985207 passed. Migration 0018 is required. Each author's transcript review, on-device recovery of an unsent recording, real storage/identity proof and device/human acceptance remain required. See `IMPLEMENTATION/ATTRIBUTED_FAMILY_VOICE_2026-11-15.md`.

## Family share links opened in a browser — routing repaired

A 2026-11-15 review found that a browser navigation to `/shared/:token` (and to any other Worker-served address) received the app shell instead of the Worker response, because single-page-application asset handling answers navigations before the Worker runs. A recipient tapping a family link therefore saw the app error screen. `wrangler.jsonc` now lists every Worker-served path in `assets.run_worker_first`, and `tests/e2e/worker-navigation.spec.ts` opens these addresses by real navigation. PR #45 merged as `a9cc1c7` after CI passed the full suite. A full created-share recipient journey against real D1/R2, and any deployed proof, remain pending. Any new Worker route prefix must be added to that list. See `IMPLEMENTATION/REPO_AND_HANDOFF_REVIEW_2026-11-15.md` and `IMPLEMENTATION/SHARE_LINK_NAVIGATION_2026-11-15.md`.

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
- Owner deletion of R2 media and connected D1 rows with a content-free deletion receipt. Existing code/tests decrement the free completion count after deletion; the earlier claim that deletion does not restore capacity was inaccurate. Resolve the intended entitlement policy explicitly before release.
- A / A+ / A++ text size; public Legacy Story Starter, `llms.txt`, OpenAPI, and MCP agent surface (ASC-01) with the private archive excluded.

## Newly merged solo trust controls and bilingual implementation

PR #21 merged as `a63c606` with owner family-link inventory/revocation, speech stop/replay cleanup and transcription retry repair. PR #22 was retargeted to main, passed fresh CI/local verification and merged as `b55aaf9`. Main now includes editable transcript/context review, owner-attributed revision history, atomic stale-version protection, explicit source confirmation and voluntary finish without required Muse turns/context/transcription. Family captions stay pinned to the selected revision. Additive migration 0008 is required before deploying this Worker/client baseline.

PR #23 merged as `cb87c56` after CI passed. It adds the current solo interface in English and Spanish, device-persisted language selection, official Clerk Spanish resources, localized family views/errors and UI-language Muse requests while preserving source testimony and unsaved edits. See `IMPLEMENTATION/ENGLISH_SPANISH_INTERFACE_2026-11-13.md` for verification and limits. The code is merged; native Spanish/Puerto Rican copy and human language acceptance remain pending.

No fresh live staging/device/human acceptance or deployment is claimed for these changes. Keep the pinned-caption reader and schema if pausing edits; never roll back to the old current-transcript sharing reader after private corrections exist.

## Archival capture and separate scans

PR #24 merged as `6af7a94` with native-still preference, device picker, labeled preview fallback, cancellation guards and untouched source-byte recovery. PR #25 merged as `3c50c49` and adds manual perspective correction/rotation, separate private scan storage/provenance/retry/replay/deletion, optional three-shot/short-delay steadiness assistance and retake source isolation. See `IMPLEMENTATION/ARCHIVAL_SCANS_STEADINESS_2026-11-13.md` for exact evidence and limits. Migration 0009 is required before its matching Worker/client.

The owner will test physical cameras after the MVP v0.5 implementation milestone; no optical, physical-device, older-user or internal solo-checkpoint acceptance is implied. The owner confirmed v0.5 includes two-person Our Living Legacy and the full V2 handoff scope; the expanded implementation target remains required. See `EXECUTION/MVP_V0_5.md`.

## Our Living Legacy engineering slices

D01 PR #26 merged as `bac2415` after CI passed: private two-person sessions, a pinned owned source photo, scoped one-use invitations, individual recording choice, revocation and English/Spanish controls. D02 PR #27 merged as `942d980` after CI run 43539395845 passed: shared original recording, recovery, private replay and separate self-attribution; evidence and limitations are in `IMPLEMENTATION/OUR_LIVING_LEGACY_RECORDING_2026-11-13.md`. This is not a claim of live video, physical/uncoached acceptance, or full MVP v0.5 completion. No Jitsi fallback is permitted.

## Expanded first-release scope

The owner explicitly included archival still capture/scans; Our Living Legacy sessions; Chapters/people/family roles/invitations/contributions; search/timeline/optional resurfacing; complete export/integrity/stewardship; and reviewed derivatives/distribution/paid plans in the same first release. See `DECISIONS/2026-11-13-expanded-first-release.md` and `EXECUTION/EXPANDED_FIRST_RELEASE.md`. These capabilities are required, not post-release deferrals. Their inclusion is a scope decision, not a claim they are implemented.

The current merged source baseline is `6af7a94`, after #24. No new live-provider, physical-device or human proof has been established.

## Internal solo foundation checkpoint (not yet passed)

The product is **not** release-locked. Remaining, in order:

1. Re-run the real-phone journey on the repaired build (iPhone Safari and Android Chrome): Photo → Voice → Save to account → Muse → context → Preserve → Playback → Share → Delete → text size.
2. Packet 4 closeout on a real phone: email and Google sign-in and second-device recovery. Facebook sign-in is deferred and does not block (`docs/DECISIONS/2026-07-16-facebook-staging-deferral.md`).
3. Three uncoached human sessions, at least one in Spanish or mixed language, confirming people can tell their own testimony apart from Muse.
4. Fix any severe trust, comprehension, or accessibility defect found, then repeat the affected step.
5. Record an internal solo foundation checkpoint before integrating the remaining required release capabilities. Lock the expanded RC only after the full release matrix passes.

Before the expanded RC lock, the production-ready-not-live hardening in `docs/EXECUTION/DEFINITION_OF_DONE_V1.md` remains: WCAG 2.2 AA review, threat model and security review, Turnstile/rate limits, secure headers, log redaction, retention and deletion-recovery policy (requires legal approval), observability and alerts, backup/rollback rehearsal, and legal wording. Production deployment itself requires separate owner authorization.

## Settled — do not reopen

| Question | Answer | Source |
| --- | --- | --- |
| Canonical product object | Living Memory. `MemoryStory` survives only as persistence names. | `DECISIONS/2026-08-11-living-memory-doctrine.md` |
| Share-to-unlock | Retired. One free Living Memory; sharing is voluntary and never rewarded. | same |
| Transcription provider | ElevenLabs Scribe v2 behind a replaceable boundary; Workers AI powers Muse text. | `DECISIONS/2026-09-22-elevenlabs-first-modular-provider-boundaries.md` |
| Muse behavior | Conversational elicitor; never judges, verifies, or invents. | `DECISIONS/2026-09-23-muse-conversational-story-elicitor.md`, `PRODUCT/STORYTELLER_SOVEREIGNTY.md` |
| Facebook sign-in | Deferred; email + Google are sufficient for the first release. | `DECISIONS/2026-07-16-facebook-staging-deferral.md` |
| Commerce | Paid plans are required for the expanded release; offers/terms and live activation remain approval gates. Historical PRs #8–#10 are not development bases. | `DECISIONS/2026-11-13-expanded-first-release.md` |
| First release | Expanded scope; all matrix rows required. Production, live charges and legally operative succession remain separately gated. | `DECISIONS/2026-11-13-expanded-first-release.md` |
| Build order within first release | Solo trust controls, archival capture, Our Living Legacy, Family Archive and remaining matrix outcomes; export/operations proceed where independent. | `DECISIONS/2026-11-13-expanded-first-release.md` |
| Shared family experience name | **Our Living Legacy**, in person or at a distance. | same |

## Branch policy

`main` is the only active development base.

The former landing, commerce, copy, cleanup, and Claude reference branches were deleted on 2026-10-01. Their historical work remains recoverable through closed pull requests and Git history; do not recreate them as reference branches.

`feat/functional-discovery-surface-01` (PR #13) is the only parked branch. It is not an alternate product line and must be rebased from current `main` before any future use.

Always branch from current `origin/main`. See `DECISIONS/2026-10-01-retire-stale-reference-branches.md`.

## Known technical debt

- `share_events.unlock_granted` and its unique index (migration 0001) are inert; the runtime never writes them. `story_entitlements.free_stories_unlocked` is fixed at 1. Drop them only in a deliberate migration with product value.
- Trigger-heavy migrations 0001–0004 apply to remote D1 through `wrangler d1 execute --file`; the normal migration path rejects them (`incomplete input`). Later migrations apply normally.
- Deploy staging only with `npm run deploy:staging` (`docs/OPERATIONS/ENVIRONMENTS_AND_HANDOFF.md`). It builds in staging mode and refuses to deploy a bundle without the Clerk publishable key, the failure seen on 2026-09-23.
- `wrangler.jsonc` intentionally carries a zero D1 ID; environments supply real IDs.
- Facebook sign-in remains deferred; `config/phase-1.ts` correctly lists only email and Google.
- ElevenLabs `voices_read` permission is unavailable on the current key; a fixed voice ID is configured.

## Next

1. PRs #21–#26 are merged, including separate scans/steadiness and the first private session boundary. D02 recording/replay is also merged. D03 now has an isolated RealtimeKit app/preset and passing synthetic real-media browser proof; complete consent-controlled remote recording/archive integration next. Continue two-person Our Living Legacy and the full V2 handoff toward MVP v0.5; collect deferred physical-camera/human and operations evidence on that candidate.
2. Build the complete expanded first-release matrix in dependency order, including all six owner-requested capability groups.
3. Complete integrated human/device/security/legal/operations evidence and present an exact candidate SHA. Production is a separate decision.

Routine engineering can proceed. Exact paid offers/terms and stewardship/contributor policies block their activation and final acceptance; current environment also lacks live staging/provider credentials. Open business questions live in `PRODUCT/OPEN_DECISIONS.md`.
