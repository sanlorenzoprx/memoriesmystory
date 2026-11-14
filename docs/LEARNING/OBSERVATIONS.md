# Learning Observations

Observations preserve evidence separately from proposed solutions. Follow `README.md` in this folder before adding or changing an entry.

### L-2026-07-15-001 — Packet 0 first screen did not express the product promise

- **Status:** corroborated
- **Evidence source:** Product-owner review of the running Packet 0 screen and supplied screenshot on 2026-07-15.
- **Observed fact:** The screen used a generic centered application card, implementation language, and a broad “Begin first memory” action. The product owner did not experience the intended invitation to capture and preserve a loved person's photograph and real voice.
- **Interpretation:** Merely storing Foundation documents in the repository does not make a hard-coded interface conform to them. Each user-facing packet needs explicit document traceability and experience-level review.
- **Confidence and contrary evidence:** High confidence from direct owner feedback. Packet 0 was intentionally a technical bootstrap, so the screen was not evidence that the approved experience itself was wrong.
- **Affected experience or invariant:** First-five-minute emotional arc; I-11 technology stays in the background; I-14 accessibility and global readiness begin at the first screen.
- **Related proposal:** P-2026-07-15-001.

### L-2026-07-15-002 — Task-specific reading paths were implicit

- **Status:** addressed
- **Evidence source:** Repository review on 2026-07-15.
- **Observed fact:** `docs/00_START_HERE.md` established document order, but the repository had no root agent instruction file mapping common implementation tasks to the exact documents, folders, and verification evidence required before action.
- **Interpretation:** A task router and nested folder guidance reduce the chance that an implementation begins from code alone or reviews unrelated documents while missing the governing contract.
- **Confidence and contrary evidence:** High. Existing README files offered useful folder summaries but did not form a complete pre-action route.
- **Affected experience or invariant:** Foundation Rule #000; outcome-driven build order; I-11 technology stays in the background.
- **Related proposal:** Implemented directly as non-behavioral repository governance in the root and nested `AGENTS.md` files.

### L-2026-07-16-001 — Production readiness must preserve a scalable architecture path

- **Status:** addressed
- **Evidence source:** Product-owner approval in conversation on 2026-07-16.
- **Observed fact:** The owner approved the Phase 1 production-ready-not-live boundary, staging/auth/language/Workers AI/Turnstile recommendations, and explicitly required the architecture always to be built to scale.
- **Interpretation:** Scale should be a verified architectural property—statelessness, durable contracts, idempotency, immutable storage, migrations, queues, observability, and environment isolation—not permission for premature services or speculative frameworks.
- **Confidence and contrary evidence:** High confidence from explicit owner direction. No evidence currently requires microservices, Durable Objects, Workflows, or a broad provider registry in the solo flow.
- **Affected experience or invariant:** I-06 immutable originals, I-07 additive history, I-08 truthful durability, I-14 accessibility, I-15 language readiness, I-16 privacy, and I-24 (then share-to-unlock integrity; now voluntary sharing per `DECISIONS/2026-08-11-living-memory-doctrine.md`).
- **Related proposal:** P-2026-07-16-001.

### L-2026-07-16-002 — Schema verification must terminate deterministically

- **Status:** addressed
- **Evidence source:** Packet 1 local verification on 2026-07-16.
- **Observed fact:** Wrangler successfully applied all D1 migration commands in the verification sandbox but its local CLI process did not terminate under the sandbox proxy, so command success could not be used as a deterministic CI gate.
- **Interpretation:** The migration's SQL structure and database invariants should be tested directly with the same SQLite semantics during Packet 1, while Cloudflare-local and staging binding behavior remains a later integration gate.
- **Confidence and contrary evidence:** High for this sandbox behavior. The migration output showed successful execution, but a hanging process is still a failed automated gate.
- **Affected experience or invariant:** I-06 immutable originals, I-08 truthful durability, and reliable build receipts.
- **Related proposal:** Addressed by `scripts/verify-d1-schema.mjs`; real Cloudflare D1 staging migration remains required before Phase 1 acceptance.

### L-2026-07-16-003 — Keyboard acceptance must begin after route focus settles

- **Status:** addressed
- **Evidence source:** Packet 2 GitHub Actions phone-Chromium run `29496384379` on 2026-07-16.
- **Observed fact:** Five browser outcomes passed, while the first keyboard test pressed Tab before the asynchronous IndexedDB recovery and route-heading focus handoff had completed. The test failed consistently even though the route correctly focused its heading after recovery.
- **Interpretation:** Route accessibility tests must first prove the intended focus handoff, then begin keyboard traversal from that known state. Otherwise they measure test timing rather than keyboard reachability.
- **Confidence and contrary evidence:** High. After explicitly awaiting the visible, focused route heading, the same keyboard and viewport path passed in CI run `29496575881` without changing product behavior.
- **Affected experience or invariant:** I-13 recoverable guidance and I-14 accessibility.
- **Related proposal:** Addressed in `tests/e2e/first-experience.spec.ts`; no Foundation change required.

### L-2026-07-16-004 — Browser durability evidence must include the Worker bindings

- **Status:** addressed
- **Evidence source:** Packet 3 implementation and GitHub Actions CI run `29498641211` on 2026-07-16.
- **Observed fact:** Vite preview could prove the client shell but could not exercise D1/R2 resource routes, interrupted uploads, server receipts, or protected playback.
- **Interpretation:** Once a packet owns Worker behavior, the phone-browser gate must run through the local Cloudflare Worker with its migrations and private bindings rather than a static asset preview.
- **Confidence and contrary evidence:** High. Unit/integration tests remained useful and fast, while the Wrangler-backed Playwright run independently proved the connected user outcome. Real staging remains a later gate and was not inferred from local evidence.
- **Affected experience or invariant:** I-01 original voice, I-06 immutable originals, I-08 truthful durability, and reliable packet evidence.
- **Related proposal:** Addressed by `npm run dev:e2e` and the Packet 3 browser suite; no Foundation change required.

### L-2026-07-16-005 — Cloud durability must not gate the act of storytelling

- **Status:** addressed
- **Evidence source:** Product-owner review of Packet 3 behavior on 2026-07-16 and revision CI run `29500804243`.
- **Observed fact:** The first Packet 3 client required a durable photograph receipt before opening voice capture. Outside service range, the original photograph remained recoverable locally but the person could not continue telling the memory.
- **Interpretation:** The experiential photo-before-voice rule means the photograph must be accepted and recoverable before recording. It does not mean cloud connectivity may block the story. Cloud photo-before-audio ordering remains a background durability invariant.
- **Confidence and contrary evidence:** High confidence from explicit owner direction and the connected offline/reconnect browser path. Device-local storage can still be evicted by the operating system, so pending state must never be described as backed up.
- **Affected experience or invariant:** I-02 photograph + voice, I-08 truthful durability, I-11 technology stays in the background, and I-13 recoverable guidance.
- **Related proposal:** Addressed by `media-background-sync.ts`, local audio acceptance, bounded retry configuration, and the Packet 3 offline continuity revision; no Foundation change required.

### L-2026-07-16-006 — Background uploads must merge into the latest local draft

- **Status:** addressed
- **Evidence source:** Packet 4 follow-up CI failure `29507040605`, focused regression tests, and green hardening CI run `29523952562` on 2026-07-16.
- **Observed fact:** An in-flight photograph upload held the draft snapshot from before recording. When that request settled, it could persist the stale snapshot and remove audio that had been accepted locally in the meantime.
- **Interpretation:** An asynchronous operation may update only the fields it owns and must merge them into the latest persisted aggregate. Its response must be ignored if the asset identity changed or that asset already reached a newer durable state.
- **Confidence and contrary evidence:** High. The failure reproduced in the existing offline phone-browser path; two focused tests cover the interleaving and replacement cases; the unchanged eight-path browser suite passed after the repair.
- **Affected experience or invariant:** I-01 original voice, I-02 photograph + voice, I-07 additive history, I-08 truthful durability, and I-11 technology stays in the background.
- **Related proposal:** Addressed in `media-background-sync.ts`; all future background synchronization of draft aggregates follows this role-scoped merge rule.

### L-2026-07-16-007 — Facebook staging requires an explicit provider-readiness boundary

- **Status:** addressed
- **Evidence source:** Product-owner staging setup and supplied provider screenshots on 2026-07-16.
- **Observed fact:** Email and Google succeeded in the isolated Clerk application. Clerk's shared Facebook connection was enabled but returned “App not active”; the custom Meta path introduced business verification, app review, privacy-policy, and deletion prerequisites before public submission.
- **Interpretation:** Provider enablement, live-path evidence, and final launch approval are distinct states. Interim staging may continue through independently verified identity paths only when the deferred provider remains visible as a release blocker.
- **Confidence and contrary evidence:** High for the observed staging paths. A custom Meta development app may later allow bounded tester evidence before public approval, but that path was not completed or claimed here.
- **Affected experience or invariant:** I-04 continuity across time, I-13 recoverable guidance, I-16 privacy by default, and truthful acceptance evidence.
- **Related proposal:** Addressed operationally by the Packet 4 preflight's explicit `deferred` state; Facebook remains required by final acceptance.


### L-2026-11-13-001 — Private corrections require frozen shared captions

- **Status:** addressed on implementation branch; review/live acceptance pending.
- **Evidence source:** repository inspection of `worker/sharing.ts` and deterministic review/sharing integration tests.
- **Observed fact:** the original share reader joined the memory's current transcript. Once owner revisions are introduced, that would silently change text available through an existing link.
- **Interpretation:** pin a bounded artifact to the selected transcript revision at creation, and pin existing/transitional artifacts before enabling private corrections. Keep that reader on rollback.
- **Affected invariants:** I-08–I-09, I-19–I-21, I-26.
- **Related decision:** `../DECISIONS/2026-11-13-storyteller-review-and-voluntary-finish.md`.

### L-2026-11-13-002 — Deletion entitlement behavior differs from prior status wording

- **Status:** new; policy decision required before release.
- **Evidence source:** `worker/deletion.ts`, migration 0004 and `tests/integration/memory-deletion.test.ts`.
- **Observed fact:** deletion decrements `free_stories_completed`; the existing test expects zero afterward. Earlier CURRENT_STATE wording claimed capacity was not restored.
- **Interpretation:** correct the evidence record; do not silently reinterpret trial/paid entitlements while introducing storyteller revisions. Choose the intended behavior explicitly with capacity/retention policy.
- **Confidence:** high for code/test behavior; no real-account or live-provider behavior asserted.
- **Affected invariants:** I-09, I-29; paid-capacity and deletion policy.

### L-2026-11-13-003 — Interface language is separate from testimony

- **Status:** addressed on implementation branch; human language review pending.
- **Evidence source:** deterministic localization/sharing/Muse tests and synthetic phone-browser language-switch journeys.
- **Observed fact:** interface controls and system notices can change language in place while imported photo hashes, storyteller text and unsaved transcript edits remain unchanged. An English phrase that is also a catalog key remains English when used as testimony.
- **Interpretation:** translate explicit application messages, never arbitrary DOM/story text. Store source metadata independently of device UI preference; use stable API codes for recovery copy. Existing Muse turns are historical content; only newly requested questions use the current UI locale.
- **Confidence and contrary evidence:** high for tested synthetic paths; native Spanish/Puerto Rican, live account/provider, physical-device and mixed-language human evidence remain pending.
- **Affected invariants:** I-02–I-06, I-08–I-10, I-17–I-18, I-19–I-21.
- **Related decision/receipt:** `../DECISIONS/2026-11-13-english-spanish-interface.md`, `../IMPLEMENTATION/ENGLISH_SPANISH_INTERFACE_2026-11-13.md`.

### L-2026-11-13-004 — Preview resolution is not native still provenance

- **Status:** addressed on implementation branch; physical-phone evidence pending.
- **Evidence source:** synthetic ImageCapture/preview browser fixtures, unit fallback/cancellation tests and prior canvas-only acquisition code.
- **Observed fact:** a 640×480 preview can return an independent 2400×1800 still. The new path preserves the exact still SHA-256 instead of rasterizing the preview. Device capture hints can open a library, so they do not prove camera origin or sensor resolution.
- **Interpretation:** prefer returned still blobs, record acquisition method honestly, label video-frame fallbacks, and retain the source unchanged for future separate scans. Decoded orientation is not independently parsed sensor/EXIF metadata.
- **Confidence and contrary evidence:** high for synthetic byte identity and failure recovery; real iPhone/Android optical quality, orientation, formats and performance still require observed evidence.
- **Affected invariants:** I-03, I-08–I-10, I-15, I-17–I-18.
- **Related decision/receipt:** `../DECISIONS/2026-11-13-archival-still-capture.md`, `../IMPLEMENTATION/ARCHIVAL_STILL_CAPTURE_2026-11-13.md`.

### L-2026-11-13-005 — Retakes need an unambiguous original source scope

- **Status:** addressed on the separate-scan implementation branch.
- **Evidence:** `loadDurableOriginals` selected the earliest durable photo/audio per draft; accepting then changing a photo could leave multiple originals under that scope.
- **Interpretation:** create a fresh draft for an accepted-photo retake; preserve prior originals/scan lineage, and scope late UI callbacks. Do not silently replace primary source identity or guess from upload completion timing.
- **Confidence/limits:** deterministic browser recovery evidence; live account/physical-phone acceptance remains pending.
- **Related decision/receipt:** `../DECISIONS/2026-11-13-separate-scans-steady-capture.md`, `../IMPLEMENTATION/ARCHIVAL_SCANS_STEADINESS_2026-11-13.md`.

### L-2026-11-13-legacy-boundary — Consent belongs to each participant

- Status: corroborated by synthetic integration and phone browser evidence; human acceptance pending.
- Evidence source: `../IMPLEMENTATION/OUR_LIVING_LEGACY_SESSIONS_2026-11-13.md`.
- Observed fact: separate participant access can expose one pinned photograph while denying archive access; own-consent checks and revocation can be enforced before recording infrastructure exists.
- Interpretation: establish this boundary before attaching any remote media provider. A display name or invitation is not proof of a distinct human's identity.
- Confidence and contrary evidence: automated boundary evidence only; no live two-device/provider or legal acceptance evidence.
- Affected experience/invariant: authentic human attribution, private originals, deliberate boundary crossing.
- Related decision: `../DECISIONS/2026-11-13-private-legacy-session-boundary.md`; no Foundation change proposed.

### L-2026-11-13-legacy-recording — Recovery must distinguish active, partial and durable audio

- Status: addressed on D02 implementation branch; physical/human acceptance remains pending.
- Evidence source: `../IMPLEMENTATION/OUR_LIVING_LEGACY_RECORDING_2026-11-13.md` and deterministic device-storage/R2 interruption tests.
- Observed fact: a recorder can have persisted a playable prefix while still producing later original chunks. Device quota failure can leave later bytes only in memory. Deletion can race an in-flight upload.
- Interpretation: use a native per-take browser lock, label recovered prefixes partial, keep volatile bytes protected while their page remains open, and verify consent/storage before durable confirmation. Whole-memory deletion needs both server intent/late-object cleanup and device cleanup.
- Confidence and contrary evidence: high for synthetic transaction/browser outcomes; no physical-phone storage pressure, real shared conversation or legal retention conclusions are established.
- Invariants: immutable real voice, truthful save status, separate attribution, deliberate privacy boundaries and recoverable interruptions.
- Related decision: `../DECISIONS/2026-11-13-legacy-original-recording.md`; no Foundation amendment.
