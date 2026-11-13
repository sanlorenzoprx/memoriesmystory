# R1b — Separate scans and steady capture

**Date:** 2026-11-13
**Base:** main `6af7a9472ae6743b84901d2161427bd8d34d7e2d`
**Branch:** `feat/archival-scans-steady-capture`
**Status:** implementation branch; final evidence below; no deployment or physical-phone acceptance.

PR #24 merged normally after CI run `43495573203` passed at `28ba78d0b4f1d3cf9ddc1f17f758e652a65a1f9b`. This supersedes the native-still receipt's unmerged status. No administrator bypass was used.

## Outcome

A person can keep an untouched photo, optionally select four print corners with drag, arrow keys or sliders, preview/rotate a corrected copy, deliberately keep it separately and recover it after reload. The scan receives its own hash/asset, refers to the durable original and retains transform/source/creation provenance. Existing photo/voice durability is independent of scan backup. Owners can reopen private scans from their memory; no scan is silently exposed through an existing family link. Whole-memory deletion removes the derivative objects and provenance in source-safe order.

Steady photo optionally takes up to three candidates and keeps the clearest by a relative detail heuristic, retaining that candidate's bytes unchanged. A short shutter delay, optional advertised continuous autofocus, support/stand guidance and explicit failure/cancellation behavior help with shaky hands. This is software steadiness assistance, not pixel deblurring or a guarantee of browser-controlled EIS/OIS. Native camera stabilization remains device-controlled. SureDose was inspected as an owner-requested reference; implementation is independent and does not inherit medical workflows or lossy source compression.

Accepted-photo retakes now create a new draft. This prevents an older durable original in the same draft from being selected during account/memory promotion; prior accepted sources remain recoverable through their address. Old asynchronous state updates are scoped to their draft.

## Evidence

Final canonical `npm run verify` passed: TypeScript client/Worker, ESLint, 126 unit/integration tests across 31 files, D1 schema validation, production build, Worker deployment dry run and all 32 phone Chromium journeys. Local Node was 24; GitHub CI separately runs Node 22. No deployment was performed.

New proof covers quadrilateral geometry/rotation and metadata normalization; exact unchanged best-shot selection and abortable delay/autofocus failure; scan storage interruption with stable retry identity; source/corner/dimension/hash/origin/scope rejection; claimed owner-only metadata and pixels; immutable provenance; full scan/source deletion; and independent photo/voice durability through repeated scan backup failure.

Browser evidence covers local scan/hash recovery, real local D1/R2 scan upload/read/delete, source hash preservation, Spanish crossing-corner recovery/original-only continuation, three-shot candidate selection, and accepted-photo retakes with earlier-source recovery. A synthetic four-color source verifies clockwise output pixels rather than merely checking that a file was created. Existing bilingual, offline, voice, review, finish and sharing journeys pass.

Initial TypeScript/lint issues (an adjacent JSX element, typed-array buffer type and an unused keyboard variable assignment) were corrected. Earlier full runs passed 126 tests and, respectively, all 30 and all 31 browser journeys as coverage grew; final coverage is 126/32. After the memory/keyboard refinement, focused capture/scan journeys also passed. The image decoder and sampling canvas are released before the resampling loop, and row yielding permits cancellation; no per-pixel accessor closure is allocated.

Main JS is 529.56 kB (156.29 kB gzip); Worker dry-run upload is 322.54 KiB (75.18 KiB gzip). The existing >500 kB bundler warning remains visible. Physical phone performance and optical benefit are not proven by these numbers.

## Anti-drift

- Idea/mechanism/value: make a physical print more readable while retaining its authentic source and real voice, with less precision demanded from older users' hands.
- Source authenticity: YES. Original bytes/identity stay unchanged; scan transforms and acquisition metadata are separate and attributed. No reconstruction or memory inference.
- Privacy/ownership: YES. Draft capability or owner-session checks; cross-draft source rejection; claimed metadata and pixels require owner session. Existing public artifacts remain original-only.
- Offline/recovery: YES. Separate local Blob/hash/upload identity survives reload. Scan storage interruptions retry idempotently; originals remain independently preservable. Late captures cannot replace another source.
- Cross-device continuity: existing account source contracts retained; backed-up scan metadata and private media reads support reopening. Real account/second-device proof remains outstanding.
- AI: N/A for scans/steady capture. Relative image detail selection is not a judgment about testimony or a guarantee of optical sharpness.
- Accessibility: 44-pixel corner handles, keyboard arrows, native slider alternative, large controls, optional scan/steady paths, readable status and English/Spanish copy. Full screen-reader/WCAG/older-person evidence remains pending.
- Growth/entitlements: no reward, charge, new capacity or automatic publication.
- Architecture: bounded browser projective resampling; additive D1 provenance over existing media roles; private conditional R2 writes and existing deletion/background boundaries. No new image provider or runtime dependency.

## Deployment and recovery

Apply migration 0009 before the matching Worker/client; migration 0008 remains required for owner review/caption pinning. These are local schema/dry-run results only; no remote migration/deployment occurred. Pause new scan writes by reverting this slice's UI/route while retaining stored scan assets/provenance and the original/caption-pinning reader. Never roll back by overwriting an original, discarding accepted scan lineage or reverting to unpinned public captions.

R2/D1 are separate services; no cross-service transaction is claimed. Existing deletion/upload race hardening, rate/cost limits and orphan-object reconciliation remain part of the operations/security release gate. A scan stuck pending must not be marked complete from client state.

## Outstanding acceptance

Actual iPhone/Android print quality, tremor/stand benefit, glare, focus, EXIF/HEIC orientation and low-memory performance; uncoached older users and Spanish copy; live identity/provider/second-device checks; final security/operations/legal evidence and the rest of the expanded release matrix. Physical testing is deferred to the owner's MVP v0.5 milestone, not silently marked passed. Automatic corner detection, generative restoration and public derivative selection are not claimed by this slice.
