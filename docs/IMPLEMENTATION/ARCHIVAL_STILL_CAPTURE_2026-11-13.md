# R1a — Native still acquisition and reliable fallbacks

**Date:** 2026-11-13  
**Base:** main `cb87c5656c9994ec0b0fabd1ebf93762888cc2ac`  
**Branch:** `feat/archival-still-capture`  
**Status:** locally verified implementation branch, pending CI/review; no deployment.

## Integrated prerequisite

Owner-authorized PR #23 merged normally as `cb87c5656c9994ec0b0fabd1ebf93762888cc2ac` after GitHub CI run `43474221542` passed at head `0e6a046b0245178e11eb19c7fe8140556e2e9772`. The bilingual receipt's branch status is superseded by this integration record. Native Spanish/Puerto Rican review, physical-device/human acceptance and the internal solo checkpoint remain pending.

## Delivered slice

- Explicit device-camera picker, with ordinary file import retained. `capture=environment` is a hint, so acquisition metadata says `device_picker` rather than asserting verified camera provenance.
- Guided capture prefers full still blobs via ImageCapture, requests maximum reported dimensions, retries defaults, and uses bounded waits with cancellation. A video-frame fallback uses actual stream dimensions and is visibly labeled.
- Environment-facing preview requests ideal 4096×3072; devices negotiate actual supported resolution. JPEG preview-frame fallback uses configured quality 0.98. Device-picker and ImageCapture files are never re-encoded by the app.
- Original Blob, SHA-256, decoded dimensions and optional method/orientation metadata survive IndexedDB recovery. Old draft records remain compatible without guessed method metadata.
- Consistent file type/25 MiB checks for all paths, image-element decode fallback, practical 1800-pixel shortest-edge guidance and manual override. No DPI, automatic corner-detection or optical-quality certification is implied.
- Abort/epoch guards prevent abandoned camera responses from changing the selection; late permission grants are stopped, pending stills can be canceled and shutter work cannot overlap. No camera permission is requested on page load.
- English/Spanish controls, pending-state labels and clear original/separate-scan copy. Existing private upload, voice, review, sharing, deletion and entitlement contracts are retained.

## Verification

`npm run verify` passed on the final code and task ledger: client/Worker typecheck, ESLint, 114 unit/integration tests across 28 files, D1 schema validation, production build, Worker deployment dry run and all 27 phone Chromium journeys. No timeout was raised, assertion skipped or retry added. Local Node was 24; GitHub CI separately runs Node 22.

Ten new unit cases cover untouched native blobs/max dimensions, default still retry, unavailable/throwing/rejected API fallbacks, timeout/late completion, cancellation, oversized still rejection without resampling and unreadable/empty capture handling. Four new phone-browser journeys cover 2400×1800 still bytes from a 640×480 preview across reload, late-still cancellation with a subsequent import, Spanish device-picker recovery after permission denial plus bitmap-decode failure, and stopping late permission grants. The existing camera journey now explicitly verifies the labeled preview fallback; keyboard evidence reflects the device-camera action first. Existing offline/voice/account/review/sharing/deletion suites pass.

The first focused browser run found a fixture assertion incorrectly using a Playwright ElementHandle where a Locator was required; the assertion was corrected without changing its capture-attribute requirement. The subsequent full run and final full run passed. Initial TypeScript identified a collision with browser PhotoCapabilities typing; the optional API boundary now uses its own structural type.

The main JS build is 510.02 kB (150.47 kB gzip); the existing >500 kB bundle warning remains a performance follow-up. Worker dry-run upload is 306.70 KiB (71.26 KiB gzip). Physical-camera performance/quality is still unproven; the build warning was not suppressed.

## Anti-drift review

- Idea/customer value: a stronger untouched source preserves more of the physical photograph for later family access and optional scans.
- Mechanism: acquire a full still where available, retain the original, recover progress and guide deliberate acceptance.
- Source authenticity, privacy, ownership: YES. Hash/bytes are retained; capture metadata is honest; no new upload destination, public surface or source replacement.
- Offline/recovery: YES. Existing local draft/upload recovery continues; late operations are invalidated; reload/source identity are tested.
- Cross-device continuity: existing original-byte upload/playback retained. New acquisition metadata is currently device-local; durable metadata/derivative linkage must follow before full R1 acceptance.
- AI: N/A. No image generation, restoration, face inference or fabricated details.
- Accessibility/language: native labeled controls, keyboard-reachable actions, cancellation, quality override and English/Spanish guidance. Phone browser tests are not physical-device or assistive-technology certification.
- Growth/entitlements: no changes. Capture does not create a share, consume capacity or reward distribution.
- Architecture: one narrow browser still-capture service and optional additive local metadata; no dependency, schema, vendor or server changes.

## Remaining R1 evidence and rollout

Manual corners and perspective correction; separate durable corrected scans with source lineage and deletion; persistent/exportable dimensions/orientation/acquisition metadata; actual angled physical prints on iPhone Safari and Android Chrome; focus/glare/framing and memory/battery/latency validation. No full R1 completion, physical-camera behavior or optical benefit is claimed from synthetic browser tests.

The source contract is ready to be extended by a separate derivative record. Never put corrected pixels into `photo.blob` or replace `photoUpload`/primary source asset IDs. Derivatives must refer to the immutable source hash/asset and carry transform parameters, version, dimensions, creation attribution and their own durability/deletion lifecycle.

This slice adds no migration or new provider. Rollback only this acquisition change atop merged main; keep the original-media pipeline, migration 0008 and pinned-caption reader. Optional capture metadata must remain readable or safely ignored. No live-provider calls, migrations, billing actions or deployments were performed here.
