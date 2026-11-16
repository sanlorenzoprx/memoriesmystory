# Foundation Package Changelog

## Automated accessibility scan — 2026-11-16

- An axe-core WCAG 2.2 A/AA scan covers 14 screens and states in English and Spanish. Text-size buttons now speak their visible text first (WCAG 2.5.3).
- A chosen contribution photograph or recording is kept on the device before it is shown, closing a reload race. No migration; no deployment is claimed.

## Muse evaluation, guard fixes and acceptance kit — 2026-11-16

- An independent Muse evaluator with a synthetic English and Spanish corpus, plus a live runner (`npm run eval:muse`) that needs owner credentials.
- The guard now also refuses Spanish judgment, preambles, invented names or numbers, and wrong-language questions, which the evaluation found reaching storytellers. The prompt wording is unchanged.
- A device and human acceptance kit for staging. No migration; no deployment is claimed.

## HEIC viewing copy — 2026-11-16

- HEIC and HEIF originals can be displayed through a JPEG viewing copy made on request by the Cloudflare Images binding. The copy is labelled with the original's id and hash, and the original is never changed. It is optional until the binding is provisioned. No migration; no deployment is claimed.

## Unsent contribution media survives a reload — 2026-11-16

- A relative's unsent voice recording or photograph is kept on the device, with its request key, until a confirmed send, a discard or the memory's deletion. No migration; no deployment is claimed.

## Runbook, threat model and route splitting — 2026-11-16

- A production runbook and launch checklist, with production still closed, and a threat model mapping threats to controls and tests.
- Pages after the first screen load on demand, shrinking the main bundle from 729 kB to 562 kB.
- Staging deploys use separate rate-limit namespaces. No migration; no deployment is claimed.

## Per-account daily ceilings — 2026-11-16

- Budget-spending operations have per-person daily ceilings, enforced atomically before routing (migration 0031). Uploads, saves and reads are never counted. Refusals say plainly that memories are safe. No deployment is claimed.

## Entitlement ledger and landing-page decision — 2026-11-16

- An append-only entitlement ledger records grants, completed memories and deletions, and agrees with the enforcement counters. Deletion follows a stated, versioned policy, keeping today's behaviour of returning capacity (migration 0030). The plan model holds one free plan with no price shown.
- Owner decision: the first screen is the landing page (G04). No deployment is claimed.

## Resend-first email, reminder cadence and direct links — 2026-11-16

- Email is sent through Resend first (with an idempotency key), falling back to Cloudflare Email Service. Sending remains off until switched on.
- Reminders follow each person's choice of every week (preselected), every two weeks or monthly (migration 0039).
- Reminder emails link straight into starting a new memory. No deployment is claimed.

## One-time sharing agreement — 2026-11-16

- By owner decision, sharing is agreed once (friends and family, and optionally public), saved with its wording version and not asked again. Facebook appears only after the public choice, and a share link requires the agreement. The Share Policy V2 gains an amendment note, and a decision record also covers the email provider order (Resend first) and person-chosen reminder cadence. Migration 0028. No deployment is claimed.

## Cost metering report — 2026-11-16

- `npm run cost:report` reads a D1 export offline and reports per-memory and total cost units, plus emails by purpose. It names what it cannot measure, and shows dollars only when every rate is set (all rates are unset for now). No migration; no deployment is claimed.

## Share handoff and referral events — 2026-11-16

- A ready family link can be sent on WhatsApp or shared on Facebook through hand-off links, with a plain statement of who can open it and that saved copies cannot be recalled.
- The share policy's growth-loop events are recorded content-free and deduplicated: prompt viewed, share started (with channel), share opened (daily per share), referred visitor, and referred first memory started and completed. There is no fingerprinting, no identifiers and no reward.
- Attributed share pages offer "Create your own Living Memory" with an opaque referral id. No migration; no deployment is claimed.

## Owner reminders — 2026-11-16

- Opt-in reminders to add a memory, at most once a calendar month and never within 28 days, skipped after a recent memory, with one-click unsubscribe and no memory content. Migration 0038 (coordinator-allocated). Wording awaits D6 approval. No deployment is claimed.

## Family update notices — 2026-11-16

- A daily pass emails opted-in invited relatives, at most once a day, when something new is shared inside their accepted scope. The email has a link to the family view, one-click unsubscribe headers and no memory content. Migration 0024 records each real send attempt. Nothing is sent or recorded while email is off. No deployment is claimed.

## Email preferences and one-step unsubscribe — 2026-11-16

- Email choices for owners and invited relatives, all off until turned on, with an append-only history (migration 0023). Signed unsubscribe links work without signing in, change nothing when opened, and turn off one kind of email for one person on a button press or a one-click POST. No email is sent yet. No deployment is claimed.

## Invitations by email — 2026-11-16

- A Cloudflare Email Service adapter that fails closed with stable codes, plus an owner option to email a family invitation's link in English and Spanish. The email carries no memory content, is sent at most once, and is never sent for an inactive invitation. Migration 0022 adds an append-only delivery record with no address or body. Sending is off (`EMAIL_SENDING_ENABLED=false`) until a sending domain is onboarded. No deployment is claimed.

## Scheduled integrity checks — 2026-11-16

- A daily cron re-hashes stored originals and sources against their preservation hashes and records match, mismatch or missing in the append-only `fixity_checks` table. Migration 0025 is required. It never repairs or rewrites media. Memory deletion removes the matching rows. No deployment is claimed.

## Dependency advisories and CI audit — 2026-11-16

- React Router 8.5.1, Vite 8.3.8 and Vitest 4.1.12 clear their advisories. Wrangler and other tooling moved to the latest versions within their existing ranges. CI now runs `npm audit --omit=dev --audit-level=high`. One moderate RealtimeKit `uuid` advisory is accepted and recorded in `docs/SECURITY/DEPENDENCY_ADVISORIES.md`. No deployment is claimed.

## Export verification — 2026-11-16

- On the archive page, **Check an export** re-hashes every file in a saved archive or album export against its own manifest, on the device, and names changed, missing and added files. Recompressed, encrypted, damaged and non-export ZIPs are refused plainly in English and Spanish. Nothing is uploaded. No migration; no deployment is claimed.

## Request-rate limiting — 2026-11-16

- Public routes, budget-spending routes (Muse, speech, transcription, scans, calls) and other writes now have per-address limits through three Workers Rate Limiting bindings declared in `wrangler.jsonc`. An over-limit request gets `429 rate_limited` with `Retry-After`. A missing or failing limiter lets the request through. No migration; no deployment is claimed.

## Album export — 2026-11-16

- From Export my archive, an owner can choose one album or one Chapter and save a verified ZIP that opens without the app, with its Chapters in order. Available on every plan. It carries only the owner's own recollections and the ones they included for family, and names what it leaves out. The export manifest gains albums and each Chapter's album. No migration; no deployment is claimed.

## Person albums — 2026-11-16

- Each named person now has an album of the memories a human linked to them, in English and Spanish. People with the same name stay separate; nothing is added by recognizing faces or voices. Owner only; no migration; no deployment is claimed.

## Security headers and Worker error fallback — 2026-11-16

- Baseline security headers on the app shell and static files, with the Content-Security-Policy in report-only mode until staging confirms its allowed origins.
- Share pages and share media are marked `noindex` and send no Referer, because their address is a bearer secret.
- An unexpected Worker error now returns a stable `503` code with no message or stack. No migration; no deployment is claimed.

## Parallel lane scaffolding — 2026-11-16

- Added lane status files and per-lane copy catalogs so several agents can work without editing the same lines; a test refuses duplicate copy keys.
- All seven private media handlers now share one response helper. A malformed or unsatisfiable `Range` returns the whole file with `200` instead of a misleading `206`; satisfiable ranges, including whole-file ranges, still return `206`. No migration; no deployment is claimed.

## Album permission for invited relatives — 2026-11-16

- The owner can let one accepted invited person make their own albums and Chapters from the memories shared with them. Migration 0021 adds the permission, its event history and album authorship, and lets an album's recorded maker place the owner's memories in it.
- A permitted relative cannot reach albums made by others, place a memory outside their invitation, or rename a memory; removing the permission or invitation stops them at once and leaves the albums with the owner. No deployment is claimed.

## Albums that hold Chapters — 2026-11-15

- By owner decision, the family archive is organized as Album → Chapter → Living Memory. The container that already held Chapters is now labelled Album in English and Spanish, with starter name ideas that create nothing until the person saves. No stored data, route or migration changed.
- Added "Album" to the Product Language and accepted the albums, reminders and export decision record with the owner's answers. No deployment is claimed.

## Shared conversations in the archive export — 2026-11-15

- The owner export now includes Our Living Legacy recordings (in-person recording; remote composite video and each participant's microphone source) as verified originals, with participants, every consent choice, the consent in force at each recording, and speaker identification only where a participant identified their own voice.
- A recording that was never fully preserved is counted as missing and the export is marked incomplete. No provider identifiers, storage keys or access hashes are exported. No migration; no deployment is claimed.

## Portable archive export — 2026-11-15

- Added an owner export built on the device: every original is downloaded, re-hashed and compared with the preserved original before being packaged into a ZIP with a hash manifest and a readable index. Human testimony, machine transcripts and Muse questions are labelled separately.
- The export states what it does not include and is marked incomplete whenever anything is missing. Our Living Legacy recordings and consent records are not yet exported; withdrawn recollections are left out.
- No migration. Restore, encryption, server-built export, fixity maintenance and stewardship remain pending; no deployment is claimed.

## Timeline from the storyteller's own words — 2026-11-15

- Added an owner timeline ordered by the year the storyteller named, showing their words unchanged. Approximate, year-less and unknown dates are kept as such; nothing is inferred or placed on a date they did not give.
- No migration or model call. Opt-in resurfacing is not built and needs an owner decision on channel and cadence; no deployment is claimed.

## Authorized family archive search — 2026-11-15

- Added literal, accent-insensitive search over human-entered words: memory names, Chapters, named people, the storyteller's current context, recollections and speaker-written words. Every match names its source and keeps "approximately".
- Invited family searches only inside their invitation and only names plus owner-included words. Revocation, scope changes and deletion apply on the next search.
- No migration, model call or vector store. Timeline and resurfacing remain pending; no deployment is claimed.

## Speaker's written words for a voice recollection — 2026-11-15

- The person who recorded a voice recollection can write and revise the words they said. Every version is kept and only the speaker can write them. Migration 0020 adds the append-only table, the owner's pinned version and guards.
- Invited family sees only the version the owner includes, beside an included voice; excluding or withdrawing the voice clears it. The recording never changes.
- No machine transcript of a contributor's voice is created; that requires an approved consent wording. Device and human acceptance remain pending; no deployment is claimed.

## Supplementary family photographs — 2026-11-15

- Added a relative's own photograph (for example the back of a print) as an immutable, separately attributed contribution reviewed by the owner before invited family sees it. It never replaces the Living Memory's original photograph. Migration 0019 adds the photo-source table and guards and recreates the read-only source view.
- Voice and photograph originals now share one confirmed-upload and scoped-playback path. Whole-memory deletion removes both.
- English and Spanish controls; the recollection form lays out one field per line. No captioning, OCR or identity matching. Transcript review, device and human acceptance remain pending; no deployment is claimed.

## Family voice recollections — 2026-11-15

- Added a relative's own recorded voice as an immutable, separately attributed contribution with owner review before invited family can hear it. Migration 0018 adds the voice-source table, guards and a read-only view; migration 0017 is unchanged.
- The voice is confirmed in private storage by read-back hash before any record exists; failed or unauthorized attempts leave nothing stored. Whole-memory deletion removes every family voice object.
- English and Spanish recorder with listen, record again, truthful saved notice and same-key retry. No transcription or generated material. Photo contributions, transcript review, device and human acceptance remain pending; no deployment is claimed.

## Family share links open in a browser — 2026-11-15

- Listed every Worker-served path in `assets.run_worker_first` so browser navigations to family share links, shared media, resource and public API addresses reach the Worker instead of the app shell.
- Added a navigation browser suite covering the share page, shared media, a resource address, health and application deep links.
- Recorded a repository and V2 handoff review receipt. No Foundation document, migration or product behaviour changed; no deployment is claimed.

## RealtimeKit unrecorded Our Living Legacy calling — 2026-11-14

- Added a managed Cloudflare call slice on existing private invitations, with optional microphone/camera, reconnect status, audio continuation and English/Spanish controls. Joining remains independent of recording consent.
- Kept auto-recording, transcription, summaries and livestreaming disabled; verified restricted preset permissions server-side. Provider mappings serialize allocation and preserve uncertain failures for reconciliation; tokens remain in memory with short validity.
- Closed provider admission and deleted participant identities on access removal/deletion. Added migration 0012 and replaced raw-SFU/Clerk calling preflight assumptions with minimal RealtimeKit configuration.
- Hosted media, recording/archive integration and physical-device acceptance remain pending; no deployment or full MVP completion is claimed.

## Storyteller review and voluntary finish — 2026-11-13

- Added attributable transcript/context revisions, original machine transcript and revision history, stale-version protection and retry-safe saves before/after completion.
- Added voluntary finish after one Muse prompt or without waiting for transcription; require explicit owner confirmation of durable originals instead of completed context fields.
- Pinned family-share captions to the selected transcript revision, including migration/cutover handling; private corrections cannot expand existing links.
- Preserved completed state when delayed transcription arrives and corrected revision deletion order. New edits can be paused without discarding history or reverting the safe share reader.
- Recorded the existing deletion/free-capacity documentation discrepancy without changing economic policy. Live providers, real phones, human acceptance and full bilingual UI remain unproven.

## Expanded first-release scope and owner controls — 2026-11-13

- Recorded the explicit owner decision to include archival scans, shared sessions, family organization/contributions, retrieval/resurfacing, export/integrity/stewardship, reviewed derivatives/distribution and paid plans in the same first release. Updated release gates and the ordered task ledger without marking unbuilt capabilities complete.
- Added paginated owner-only family-link inventory and revocation controls that survive returning to a memory; public page/photo/voice access closes after revocation, without listing bearer tokens.
- Made Muse playback stoppable and replayable with cancellation and object URL cleanup; restarted transcription polling after a retry.
- Production, live billing, final paid offers and legally operative succession remain separate decisions.

## Packet 3 offline continuity revision — 2026-07-16

- Removed cloud photograph durability as a gate to recording the memory story.
- Added a bounded background synchronization queue that preserves immutable photo-before-voice upload order.
- Added local voice acceptance, reload recovery, automatic reconnection resume, and calm device-safe pending language.
- Added the family-archive confirmation only after both R2 objects and D1 receipts are independently verified.
- Added unit coverage for ordered retries and a phone-first offline-record-reconnect acceptance path.
- Kept Packet 4 active for identity, ownership, secure draft promotion, and second-device continuation.

## Packet 3 original media durability — 2026-07-16

- Added scoped anonymous draft tokens with only SHA-256 hashes stored in D1.
- Added private photograph/audio upload, status, and range-capable playback Worker routes.
- Added MIME signature, size, checksum, duration, origin, ownership, immutability, and idempotency enforcement.
- Added conditional private R2 originals and D1 durability/operation receipts with interrupted-write recovery.
- Added contextual microphone recording, 30-second centralized allowance, local recovery/playback, safe retry, and preserved-original playback.
- Moved Playwright through local Wrangler D1/R2 bindings and passed eight phone-first paths.
- Activated Packet 4 after the complete Packet 3 gate passed.

## Packet 2 local-first capture and onboarding — 2026-07-16

- Replaced the static introduction with a phone-first `/capture/:draftId` camera/import experience.
- Added contextual camera permission, unsupported/denied-camera recovery, and a universal import fallback.
- Added versioned IndexedDB draft/original-photo persistence with SHA-256 identity and reload recovery.
- Added one-at-a-time resolution, glare, shadow, and focus guidance with a deliberate manual override.
- Added honest local-only state language; no durable-save or completion claim appears.
- Expanded CI to all packet branches and passed six phone-Chromium acceptance paths.
- Activated Packet 3 only after the complete Packet 2 gate passed.

## Packet 1 domain and persistence contracts — 2026-07-16

- Added framework-independent Memory Story, media, truth/provenance, entitlement, idempotency, and durable-receipt contracts.
- Centralized five-story/30-second entitlements, media limits, MIME types, locales, and explicit unresolved privacy/provider configuration.
- Added the initial indexed D1 schema for ownership, drafts, stories, immutable media, additive transcripts/facts/events, entitlements, private shares, agreements, and operation receipts.
- Added database enforcement for immutable original identity, fail-closed completion, and append-only transcript revisions.
- Added deterministic private R2 original/derivative key builders and the private object policy.
- Added local schema integrity testing and invariant-focused unit tests.
- Activated Packet 2 only after the complete Packet 1 core gate passed.

## Packet 0.3 scalable campaign handoff — 2026-07-16

- Recorded the approved Phase 1 production-ready-not-live campaign boundary.
- Made English/Spanish, email/Google/Facebook acceptance, isolated staging, Workers AI first, and Turnstile protection explicit.
- Added scalable-architecture rules centered on stateless execution, immutable media, idempotency, durable queues, migrations, configuration, and observability.
- Added campaign authority, stop rules, source manifest, phase gates, one-active-task queue, master build prompt, environment handoff, tests, and receipt.
- Kept production deployment, public launch, billing, destructive data actions, and scope expansion separately authorized.

## Packet 0.2 production-readiness guardrails — 2026-07-16

- Added committed Playwright configuration and phone-first browser tests.
- Added CI browser execution and Cloudflare deployment dry-run gates.
- Reconciled the R2 binding as `MEDIA_BUCKET` and declared the Workers AI `AI` binding.
- Added the secret/configuration contract and empty local template.
- Established Definition of Done v1.0 as production ready, not live.

## Packet 0.1 first-screen direction — 2026-07-15

- Replaced the generic centered placeholder with a full-viewport, mobile-first first experience.
- Added the approved loving-urgency copy, **Capture Your Memories**, **Import a photo**, and the quiet `Photo → Voice → Preserved → Shared` journey.
- Added a warm paper-and-light visual system, keepsake photograph surface, responsive layout, reduced-motion behavior, forced-colors support, and keyboard skip navigation.
- Removed entitlement, save-state, packet, and Muse language from the first screen.
- Added tests locking the approved copy and first-screen language boundary.
- Added the Packet 0.1 implementation receipt and linked it to the learning proposal.

## Repository guidance and learning memory — 2026-07-15

- Added a root task router and nested application, documentation, runtime, and verification guides.
- Added an explicit Phase 1 route review map.
- Added a controlled learning loop that separates evidence, proposals, approval, document updates, and verification.
- Recorded the Packet 0 first-screen review and the approved Packet 0.1 design proposal without modifying the UI yet.

## Fresh-start repository package Version 1.1 — 2026-07-15

- Set the Windows working path to `C:\repos\memoriesmystory`.
- Standardized every technical application identifier on `memoriesmystory`.
- Added the binding application identity standard.
- Renamed the Soul Foundation filename to use the exact `memoriesmystory` application identifier.
- Preserved **Memories: My Story** only as customer-facing brand language.

## Fresh-start repository package Version 1.0 — 2026-07-15

- Combined Foundation Version 1.1 and the Phase 1 solo Memory Story build specification into one repository-ready package.
- Set `sanlorenzoprx/memoriesmystory` as the only canonical application repository.
- Removed references to application histories and competing code sources.
- Established a fresh repository implementation rule.
- Added a fresh repository decision record and Implementation document index.
- Reframed Packet 0 as a clean React Router and Cloudflare bootstrap.
- Included no application code from another codebase.
- Reconciled the build order so Phase 1 includes the minimum share-to-unlock path required by the binding experience contract.

## Version 1.1 — 2026-07-15

- Accepted the first-five-minute experience as the binding first implementation contract.
- Clarified that timing targets never rush emotion or accessibility needs.
- Added just-in-time camera and microphone permission guidance.
- Added progress preservation across interrupted sign-in and confirmed email, Google, and Facebook account paths.
- Added manual capture override after honest image-quality guidance.
- Clarified that original photograph and voice preservation cannot be blocked by transcription, enhancement, or Muse processing.
- Confirmed that sharing follows preservation and may be completed later.
- Added repeating, adaptive, replayable guidance for the first few uses.
- Added end-to-end acceptance criteria and a formal decision record.
- Marked Foundation Phase 0 complete.

Locked Founding Principles, Product Invariants, Product Vision, and The Soul of Memories: My Story were not changed.

## Version 1.0 — 2026-07-15

- Organized the constitutional Foundation, product controls, architecture starting point, source traceability, repository structure, and implementation build order.
