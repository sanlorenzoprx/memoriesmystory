# Memories: My Story V3 — Autonomous Engineering Handoff

**Version:** 3.0 — 2026-11-16
**Repository:** `https://github.com/sanlorenzoprx/memoriesmystory`
**Verified main:** `d0b5fa1790044aef70be4d3518d2b7af2bda38ac` (merge of PR #54), CI run 43784546004 green on the merged head.
**In flight:** nothing. No pull request other than the parked PR #13 is open.
**Supersedes for status:** the V2.1 handoff (2026-11-15), which stopped at PR #42. Its requirements still stand; its status tables do not.
**Audience:** the next implementing model or engineer, and the owner.

> **Mandate.** Finish the expanded first release (MVP v0.5) of a private-first, voice-first Living Memory Archive: one real photograph, the person's real voice and unjudged recollections, an optional helping conversation, and an enduring family archive that relatives can add to, find things in, take with them, and pass on.

This document is a dated cross-reference. The live ledger is `docs/EXECUTION/TASK_QUEUE.json` and the live status page is `docs/CURRENT_STATE.md`. Where this document and the code disagree, the code and its receipts win; fix this document.

---

## 1. How to work in this repository

### 1.1 Authority, in order

1. `AGENTS.md`, the nearest nested `AGENTS.md`, `docs/00_START_HERE.md`.
2. `docs/FOUNDATION/` — especially `01_PRODUCT_INVARIANTS.md`, `05_PRODUCT_LANGUAGE.md`, `06_AI_BEHAVIOR_GUIDE.md`.
3. Accepted decision records in `docs/DECISIONS/` and product policies in `docs/PRODUCT/`.
4. Code, tests and receipts in `docs/IMPLEMENTATION/`.
5. This handoff.

### 1.2 Rules that never bend

- Original photograph and voice files are immutable. Corrections, scans, transcripts, written words and exports are separate, attributed additions.
- "Saved" is shown only after the server confirms durable storage, and after the client reads the authoritative record back.
- Human testimony, machine output and Muse material stay visibly distinct. Muse never judges, corrects or reconciles a memory.
- Different people's recollections stay separate and attributed. Approximate, unknown and omitted are valid answers.
- New material is private by default. Sharing is the creator's deliberate act and is never rewarded.
- No face recognition, voice recognition or inferred identity or relationships.
- No real family content in tests, logs, fixtures or prompts. Tests use synthetic bytes.
- Every technical identifier is `memoriesmystory`; the brand is **Memories: My Story**.
- Customer words: Living Memory, Album, Chapter, Our Living Legacy, Muse, Capture Your Memories.

### 1.3 The loop every slice followed (keep following it)

1. Start from current `origin/main`. One packet at a time.
2. Read the governing documents and the code and tests you will touch.
3. Build the smallest complete vertical slice: migration (append-only), Worker route, client, English and Spanish copy, unit + Worker + browser tests.
4. Run `npm run verify:core`, then the browser suite.
5. Write a receipt in `docs/IMPLEMENTATION/`, update `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json`, `CHANGELOG.md`, and `migrations/README.md` and `tests/e2e/README.md` where relevant.
6. Open a pull request. Merge only when the `Verify` check is green. The owner gave standing permission on 2026-11-15 to merge each pull request once its CI passes.
7. Never deploy to production, charge anyone, or publish real family media. Those are separate owner authorizations.

### 1.4 Commands

```bash
npm ci
```

```bash
npm run verify:core
```

```bash
npm run test:e2e
```

`verify:core` runs typecheck, lint, unit and Worker tests, the D1 schema check, the build and a Cloudflare deploy dry run. CI (`.github/workflows/ci.yml`) runs `npm run verify`, which adds the browser suite, on pull requests and on pushes to `main`. A branch with no pull request gets no CI.

### 1.5 Traps already hit — do not repeat them

- **Do not chain a commit after a piped test command.** `npm test | grep … && git commit` commits even when tests fail, because the pipe's exit status is `grep`'s. Capture the exit code first, then commit only if it is zero. This caused one bad push (fixed before its pull request opened).
- **Never run `git checkout <file>` or `git stash drop` on work in progress.** Uncommitted slices live in the working tree between merges.
- **`run_worker_first`.** `wrangler.jsonc` lists every Worker-served path prefix (`/shared/*`, `/resources/*`, `/api/*`, `/mcp`, `/health`, `/robots.txt`, `/sitemap.xml`). Browser navigations to any other Worker path are answered with the app shell. Add any new top-level Worker prefix to that list and to `tests/e2e/worker-navigation.spec.ts`.
- **The ledger has a contract test.** `tests/unit/handoff-contract.test.ts` requires exactly one task with status `active` and that it equals `active_task_id`. When you move the active task, update both the JSON and that test.
- **Two older fixtures list migrations by name.** `tests/integration/memory-deletion.test.ts` and `tests/integration/living-memory-completion.test.ts` must have each new migration added to their lists. `scripts/verify-d1-schema.mjs` must list each new table, index, trigger and view.
- **Immutable tables cannot be altered.** SQLite cannot relax a `CHECK`. Add a sibling table (and a view when one read shape is needed) instead of rebuilding a table that holds testimony. `family_access_grants.role` is fixed to `viewer`/`contributor`; new permissions go in their own table (see `family_album_permissions`).
- **Database triggers enforce authorship.** Several inserts require the actor to be the archive owner. When a new actor is legitimately allowed, replace the trigger in a new migration; do not mislabel who acted.
- **Numbered SQL parameters.** Several routes use `?1`, `?2` … so one value can be reused. Every index up to the highest must be bound.
- **Wrapping labels.** A `<label>` that wraps its `<textarea>` gets an accessible name that includes the typed text, so exact-name lookups fail after typing. Use `htmlFor` and `id`.
- **Sandbox browser.** Cloud sandboxes may ship a different Chromium build than the project's pinned Playwright. Run the suite with a temporary config that sets `launchOptions.executablePath`. `tests/e2e/legacy-recording.spec.ts` launches its own browser and cannot use that override, so its 9 checks only run in CI. Every receipt says so; CI is the authority.
- **Schema-wide deletes.** `worker/deletion.ts` deletes R2 objects before the D1 cascade. Every new stored object type must be added there, including a prefix sweep for unreferenced attempts.
- **Export.** Every new source type must be added to `worker/archive-export.ts`, or the export must list it under `notIncluded`.

---

## 2. What is built and merged

Test totals on `main`: 275 unit and Worker tests in 64 files, 117 required schema objects, 78 browser tests (69 run locally plus the 9 CI-only).

| Capability | State | Pull requests | Key files | Migrations |
| --- | --- | --- | --- | --- |
| Solo Living Memory: capture, voice, Muse, review, finish, share, revoke, delete, English/Spanish | Merged | through #23 | `app/features/capture`, `living-memory`, `worker/media-routes.ts`, `muse*.ts`, `completion.ts`, `sharing.ts`, `deletion.ts` | 0001–0008 |
| Archival capture and separate corrected scans | Merged | #24, #25 | `worker/photo-scans.ts`, `app/services/perspective-scan.ts` | 0009 |
| Our Living Legacy: in-person and remote sessions, consent, recording, private replay | Merged; synthetic cloud proof | #26–#39 | `worker/legacy-*.ts`, `realtimekit*.ts` | 0010–0013 |
| Albums and Chapters (stored as `family_archives` → `family_chapters`) | Merged | #40, #41, #53 | `worker/archive-routes.ts`, `FamilyArchivePanel.tsx` | 0014 |
| Named people and relationships | Merged | #42 | `worker/people-routes.ts`, `PeoplePanel.tsx` | 0015 |
| Scoped family invitations (viewer, contributor; memory, Chapter or album scope) | Merged | #43 | `worker/family-access-routes.ts`, `family-permissions.ts` | 0016 |
| Family contributions: written, voice, photograph, speaker-written words, owner review | Merged | #44–#47 | `worker/family-contributions.ts`, `FamilyContributionsPanel.tsx`, `ContributionVoiceRecorder.tsx`, `ContributionWrittenWords.tsx` | 0017–0020 |
| Share links open in a browser (`run_worker_first`) | Merged | #45 | `wrangler.jsonc`, `tests/e2e/worker-navigation.spec.ts` | — |
| Search within each person's access | Merged | #48 | `worker/family-search.ts`, `app/domain/family-search.ts` | — |
| Timeline from the storyteller's own words | Merged | #49 | `worker/family-timeline.ts`, `app/domain/family-timeline.ts` | — |
| Plain archive export with verified originals, including shared conversations | Merged | #50, #52 | `worker/archive-export.ts`, `app/domain/archive-export.ts`, `ArchiveExportPanel.tsx` | — |
| Album wording, starter album ideas, accepted decision record | Merged | #51, #53 | `docs/DECISIONS/2026-11-15-albums-reminders-export-tiers.md` | — |
| Owner lets an invited relative make albums | Merged | #54 | `worker/archive-routes.ts` (`?grantId=`), `family-api.ts` | 0021 |

Nothing is deployed to production. No live billing exists. Migrations 0014–0021 are on `main` and have not been applied to any persistent environment.

### 2.1 Patterns to reuse rather than reinvent

- **Confirmed original upload** — `worker/family-contributions.ts`, the `uploadKind` block: explicit consent headers, type and file-signature check, client SHA-256 compared with received bytes, access checked before storage and again inside the D1 batch, per-attempt R2 key, head and read-back hash before any record exists, delete the attempt's object on any failure, same-key replay.
- **Atomic authorization** — the `permission` SQL fragment in `family-contributions.ts` and `stillPermitted` in `archive-routes.ts` re-check access inside the write batch.
- **Idempotent writes** — `operation_receipts` keyed by a hash of user, operation and the client's `X-Idempotency-Key`; a changed body with the same key is a `409`.
- **Scoped reads for relatives** — `activeFamilyGrant` plus `grantAllowsMemory` (`worker/family-permissions.ts`); re-check after any storage read.
- **One read shape over several immutable tables** — the `family_contribution_sources` view.
- **Truthful client state** — every panel shows "saved" only after an acknowledgement and a canonical re-read, keeps the person's input on failure, and reuses the same request key on retry.
- **Copy** — English text is the catalog key; add the Spanish in `app/localization/messages.ts`; map API error codes in `app/localization/errors.ts`. People's own words are never translated.

---

## 3. Owner decisions on record

| Date | Decision | Where |
| --- | --- | --- |
| 2026-11-13 | All six capability groups are in the first release; solo is the entry experience, not the boundary. | `docs/EXECUTION/EXPANDED_FIRST_RELEASE.md` |
| 2026-11-13 | Camera and device testing is deferred until the full MVP v0.5 is implemented. It is deferred, not waived. | V2 handoff |
| 2026-11-15 | Merge each pull request once its CI passes; stop only when owner input is required. | chat instruction |
| 2026-11-15 | Album → Chapter → Living Memory; the customer word is "Album". | `docs/DECISIONS/2026-11-15-albums-reminders-export-tiers.md` |
| 2026-11-15 | The owner may let an invited relative organize albums and add albums and images. | same |
| 2026-11-15 | Reminders and invitations go by Cloudflare Email to both the owner and invited family, with direct links. | same |
| 2026-11-15 | Album export is available to basic and premium alike. Plain file export stays available to everyone. | same |

### 3.1 Still needed from the owner

1. **A relative's upload becoming a new Living Memory.** Today a relative adds images only as reviewed photograph contributions on an existing memory. A new memory needs a photograph and a voice and counts against the owner's plan. Decide whether a relative's image may create a memory, an album-only photograph, or neither.
2. **Contributor rights.** Deleting a memory deletes relatives' contributions with it. A withdrawn contribution stays readable by the owner. Whether a recorded guest may later ask to be left out of exports. All follow current behaviour until decided.
3. **Machine transcripts of relatives' voices.** Not built: the contribution agreement (`family-contribution-review-v1`) does not cover sending a relative's voice to the transcription provider. Needs new consent wording.
4. **Cloudflare Email setup.** A sending domain onboarded in the owner's Cloudflare account, the sender address, and the reminder cadence wording.
5. **Stewardship policy (F02).** Who may be designated, when access starts, revocation, competing claims.
6. **Prices, terms, refund policy and what "premium" contains (H01–H03).**
7. **Final legal wording** for recording consent, contribution agreement, retention and deletion.
8. **Voice length.** Solo and contributed voices are limited to 30 seconds (`config/phase-1.ts`). This is a product hypothesis the owner has not revisited.

Ask with one short decision memo and a recommended default; keep working on everything that does not depend on the answer.

---

## 4. Remaining work, in order

Each item names the outcome, the design that fits the existing code, and what proves it. Sizes are relative.

### 4.1 Finish the album direction (owner decision 2026-11-15)

**A. Person albums** — small.
Opening a named person shows the memories a human linked to them, as an album view.
- Data exists: `family_people_records.document_json.memoryIds`.
- Add an owner read in `worker/people-routes.ts` (or reuse the listing) and a view in `PeoplePanel.tsx` or the album panel. No face or voice matching; ambiguous or same-name people stay separate.
- Tests: two people with the same name stay separate; a removed link disappears; another account sees nothing.

**B. Album export (packet G01)** — medium. This is the required "at least one reviewed, source-grounded derivative".
A designed, readable album of one album or Chapter: cover, photographs, the storyteller's words, attributed family recollections, with voices as playable files beside it.
- Build it on the device like the plain export: reuse `buildStoredZip` and the per-file hash check in `ArchiveExportPanel.tsx`; produce `album.html` plus the media and a `sources.json` manifest listing every source id and hash.
- The owner selects what goes in, sees a preview, and confirms before saving. Store nothing generated as testimony. No model-written narrative.
- Available to every owner. Do not gate it.
- Tests: manifest matches the selection; an unselected or withdrawn contribution is absent; machine transcripts are labelled; originals hash to their manifest values.

**C. Relative-added images** — blocked on decision 3.1 item 1.

### 4.2 Email through Cloudflare Email (owner decision; packet E06b and invitations)

Medium to large. Read Cloudflare's current Email Service documentation before writing code; the binding and API details change.
- Add a narrow provider adapter (`worker/providers/email-provider.ts`) behind an environment binding, with a test double. Fail closed when unconfigured.
- **Invitations by email.** Today an invitation is a copied link bound to a verified recipient email (`family-access-routes.ts`). Send that link to the target address. The link must still require the verified account; forwarding it grants nothing.
- **Notifications to invited family**, for example that a recollection was included for them. The message says only that something is waiting and links to the family view. Never include a private memory's content.
- **Reminders to the owner.** Opt-in, with a visible cadence, a one-step unsubscribe link that works without signing in, and a stored preference table. Verify opt-out by test.
- A link meant to be passed around publicly is the owner's existing bounded family share link (`/shared/:token`), never an invitation.
- No reward for sharing. No urgency or grief-based wording. No real addresses in logs.
- Tests: unconfigured provider fails closed; opt-out stops sends; a revoked invitation sends nothing; message bodies contain no testimony; idempotent sends.
- Needs from the owner: sending domain and cadence wording (3.1 item 4).

### 4.3 Continuity (packets F01–F03)

**F01 remaining** — the plain export is merged. Still required:
- **Restore check**: a tool or page that reads an export ZIP and verifies every file against `manifest.json`. Re-import into an archive is optional; verification is not.
- **Large archives**: the export is built in the browser and capped at 1.5 GB. Add a server-built export (a queued job writing to private R2 with a short-lived download) with cancel, retry and an explicit incomplete state.
- **Encryption**: the ZIP has no password. Decide with the owner how a person keeps the key before adding it.
- Add to the export, or keep listing under `notIncluded`: scan correction parameters, people history versions, share-link inventory.

**F03 integrity maintenance** — medium.
- A scheduled Worker that samples stored objects, re-hashes them against their receipts, and records an append-only fixity result. Never rewrite or delete an original to repair.
- A documented, rehearsed D1 and R2 backup and restore, with a receipt. Do not claim permanence or "deleted everywhere" without it.

**F02 stewardship** — policy-gated. Prepare the concrete flow (designate, revoke, waiting period, recovery) and tests behind an off switch, plus a one-page policy proposal. Do not activate without the owner's approval (3.1 item 5).

### 4.4 Distribution and referral (packets G02, G03)

- **G02**: deliberate WhatsApp and Facebook handoff of the existing bounded share artifact, with a preview that matches the selection and a plain statement that copies cannot be recalled. No direct publishing API without separate approval. No public feed.
- **G03**: privacy-safe funnel events (`living_memory_share_prompt_viewed`, `…_share_started`, `…_share_opened`, `living_memory_referred_visitor`, `referred_first_living_memory_started`, `…_completed`). Idempotent, no story content, no fingerprinting, no reward.

### 4.5 Muse evaluation (packets B01–B03)

- B01: a synthetic, license-safe English/Spanish scenario corpus and evaluator kept separate from runtime code: clear details, missing or approximate dates, disagreeing relatives, grief, code-switching, "stop" and "just save it", prompt-injection-looking speech, empty and very long transcripts.
- B02: a minimal switch to compare models; record latency, cost and failures. A "no change" decision is valid.
- B03: fix only measured failures. No invention, no judgment, no worse latency or cost.

### 4.6 Paid plans (packets H01–H03)

Blocked on prices and terms (3.1 item 6). Buildable now: measured cost per completed memory, session, export; a server-owned Stripe **sandbox** checkout with a verified, replay-safe webhook and an entitlement ledger; tests for duplicate and out-of-order events, wrong amount, currency or account, refunds, and pending states. The success page must never grant anything. Live keys and live charging need separate authorization.

### 4.7 Release hardening (packet A07)

Open findings from `docs/IMPLEMENTATION/REPO_AND_HANDOFF_REVIEW_2026-11-15.md`:

| Finding | Work |
| --- | --- |
| F2 | Baseline security headers on the app shell via `public/_headers`; CSP in report-only first (Clerk and RealtimeKit need allow-listed origins). `X-Robots-Tag: noindex` and `Referrer-Policy: no-referrer` on the public share page and its media. |
| F3 | Request-rate limiting on unauthenticated routes (public agent API, share and invitation lookups, session creation, anonymous uploads) and on search and export. Use the Workers Rate Limiting binding. |
| F6 | An out-of-range `Range` header returns `206` over the whole object in five older media handlers. The newer `family-contributions.ts` handler is correct; extract one shared helper. |
| F7 | `react-router` advisory (not exploitable in this client-only use), `uuid` via RealtimeKit, development-only advisories. `npm audit fix` crashed inside npm on 2026-11-15; retry, then add an audit step to CI. |
| F9 | One outer `try/catch` in `worker/index.ts` returning a stable error code. |
| F10 | A dead-letter queue for the transcription consumer. |
| F11 | Document that rotating `SESSION_SECRET` invalidates pending invitations, or derive invitations from a separate secret. |

Also required: a threat model, observability without story content, WCAG 2.2 AA review, the main bundle split by route (652 kB before gzip), and an isolated staging deployment of the whole application with migrations 0014–0021, hosted Clerk recipient acceptance, and real R2 checksum behaviour.

### 4.8 Final acceptance (packet A08 and R9)

Owner-deferred, not waived: physical Android Chrome and iPhone Safari, a second device, two phones on two networks for a remote conversation, an angled printed photograph, three uncoached people including one Spanish or mixed-language storyteller. An agent can prepare scripts and evidence templates; it cannot certify people or devices.

### 4.9 Lower-priority gaps recorded in receipts

- Unsent voice recordings, photographs and speaker-written words are lost on reload (written recollections survive). Persist them in IndexedDB like `legacy-recording-store.ts`.
- HEIC photographs are stored but most non-Apple browsers cannot display them.
- Search does not cover machine transcripts, people notes, drafts or "recently played", and is literal by design.
- The timeline is owner-only and uses only the storyteller's "time" detail.
- Photograph contributions are capped at 15 MiB because the Worker buffers them to hash; larger files need the streaming path in `worker/original-source-storage.ts`.

---

## 5. Required packet status

| Packet | State | Remaining |
| --- | --- | --- |
| A01 share inventory and revoke | Merged; routing fixed in #45 | Recipient journey with a real created share against real storage; device and human proof |
| A02–A04 review, finish, English/Spanish | Merged | Human proof |
| A05–A06 voice resilience, viewing | Substantial | Device and accessibility proof |
| A07 release engineering | Open | 4.7 |
| A08 human and device proof | Owner-deferred | 4.8 |
| B01–B03 Muse evaluation | Not started | 4.5 |
| C01–C02 archival capture and scans | Merged | Physical print and device proof |
| D01–D03 Our Living Legacy | Merged; synthetic cloud proof | Device, network and human proof; policy; activation |
| E01–E03 albums, people, invitations | Merged | Hosted Clerk recipient acceptance; person albums (4.1 A) |
| E04 family contributions | Merged (text, voice, photograph, speaker-written words) | Policy decisions; machine transcript only with new consent |
| E05 search | Merged (literal, scoped) | Draft and recent discovery; rate limiting |
| E06 timeline and resurfacing | Timeline merged | Email reminders (4.2) |
| F01 export | Plain export merged | Restore check, large archives, encryption (4.3) |
| F02 stewardship | Not started | Policy-gated (4.3) |
| F03 integrity | Ingestion hashing only | Fixity and restore rehearsal (4.3) |
| G01 derivative | Not started | Album export (4.1 B) |
| G02–G03 distribution, referral | Foundation only | 4.4 |
| H01–H03 paid plans | Not started | 4.6 |
| Album permission for relatives | Merged (#54) | Relative-added images need an owner decision; hosted and human proof |

No percentage-complete figure is justified. The capture, recording, organization, contribution, retrieval and export foundations are built and tested with synthetic data. Email, keepsake export, integrity maintenance, stewardship, distribution, commerce, Muse evaluation, hardening and every real-world proof remain.

---

## 6. Evidence levels — say which one you have

`CODED` → `UNIT_PROVEN` → `INTEGRATION_PROVEN` → `STAGING_LIVE_PROVEN` → `REAL_DEVICE_PROVEN` → `UNCOACHED_HUMAN_PROVEN` → `PRODUCTION_AUTHORIZED`.

Everything merged since PR #43 is `INTEGRATION_PROVEN` with stubbed browser journeys. None of it has run on persistent Cloudflare storage, with hosted Clerk, on a physical phone, or with a real family. Receipts must keep saying so.

---

## 7. Prompt for the next implementer

> You are continuing the Memories: My Story expanded first release. Read `AGENTS.md`, `docs/00_START_HERE.md`, `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `docs/EXECUTION/V3_AUTONOMOUS_ENGINEERING_HANDOFF_2026-11-16.md` first. Fetch `origin/main`, record its SHA, and run `npm ci` and `npm run verify:core` before changing anything.
>
> Work through section 4 of the V3 handoff in order: person albums, album export, Cloudflare Email invitations and opt-in reminders, export restore check and large-archive export, integrity maintenance, distribution and referral events, Muse evaluation, sandbox commerce, release hardening. One packet per pull request, started from current `main`.
>
> For every slice: append-only migration, Worker route with authorization re-checked inside the write, client with truthful saved state and same-key retry, English and Spanish copy, unit, Worker and browser tests, a receipt under `docs/IMPLEMENTATION/`, and updates to the status page, ledger, changelog and readmes. Add every new stored object to deletion and to the export. Capture test exit codes before committing. Merge when CI is green.
>
> Keep originals immutable, recollections separately attributed, generated material distinct, and new material private by default. Do not infer identity. Do not send a relative's voice to a transcription provider under the current agreement. Do not deploy to production, charge anyone, publish family media, or activate stewardship. When a decision in section 3.1 blocks a packet, write one short decision memo with a recommended default and continue with unblocked work. State the evidence level you actually reached; do not claim staging, device or human proof from local tests.

---

## 8. Reference

**Worker routes** (`/resources/…`): `archive`, `archive-export`, `drafts`, `family-access`, `family-archives`, `family-contributions`, `family-people`, `family-search`, `family-timeline`, `legacy-sessions`, `living-memories`; public `/shared/:token`, `/api/v1/*`, `/mcp`, `/health`.

**Migrations:** `0001`–`0013` solo through remote recording; `0014` albums and Chapters; `0015` people; `0016` invitations; `0017` written contributions; `0018` voice contributions and the sources view; `0019` photograph contributions; `0020` speaker-written words; `0021` album permission.

**Receipts written 2026-11-15 and 2026-11-16** (`docs/IMPLEMENTATION/`): `REPO_AND_HANDOFF_REVIEW`, `SHARE_LINK_NAVIGATION`, `ATTRIBUTED_FAMILY_VOICE`, `ATTRIBUTED_FAMILY_PHOTO`, `SPEAKER_WRITTEN_WORDS`, `AUTHORIZED_FAMILY_SEARCH`, `STORYTELLER_TIMELINE`, `PORTABLE_ARCHIVE_EXPORT`, `ALBUMS_AND_CHAPTERS`, `FAMILY_ALBUM_PERMISSION`.

**Decision record:** `docs/DECISIONS/2026-11-15-albums-reminders-export-tiers.md`.

**Configuration:** limits in `config/phase-1.ts` (`familyContributions`, `familyAccess`, `familyArchive`, `familyPeople`, `entitlements`); search, timeline and export limits in their `app/domain/` modules.

## Version history

- **1.0, 2.0 — 2026-11-13; 2.1 — 2026-11-15:** earlier handoffs, status through PR #42.
- **3.0 — 2026-11-16:** status through PR #54; owner decisions of 2026-11-15; remaining work re-ordered around albums, email, continuity, distribution, evaluation, commerce and hardening; working conventions and traps recorded.
