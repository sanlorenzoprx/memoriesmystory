# Separate archival scans and digital steadiness assistance

**Date:** 2026-11-13
**Authority:** owner requested the next archival slice, digital stabilization/steadiness support for older adults, and inspection of the SureDose camera settings. Physical camera testing is scheduled by the owner after the MVP v0.5 implementation milestone; it is not claimed complete.

## Scope and source authenticity

This branch starts from main `6af7a9472ae6743b84901d2161427bd8d34d7e2d`, following the owner-authorized integration of PR #24 after its CI passed. It adds manual perspective correction, quarter-turn rotation, separate private scan preservation/recovery/replay/deletion, and camera steadiness assistance. Foundation source, privacy, ownership, language and completion rules are unchanged.

The original Blob/checksum/asset remains canonical. A person may place four corners, preview, rotate and explicitly keep a separate corrected JPEG. Default corners cover the entire image; cropping is deliberate. Crossing, collapsed or tiny quadrilaterals are rejected. Original-only preservation always remains available. Perspective interpolation, opaque-white transparency flattening, rotation and bounded output sampling are deterministic derivatives; there is no generative reconstruction, face repair or automatic interpretation of marks. Output is limited to configured dimensions/pixels for phone memory; this is not an optical DPI certification.

A scan is an `enhanced_photo` asset pointing to a durable `original_photo` in the same draft. New migration 0009 adds immutable transform/source-checksum/creation-attribution provenance. Source dimensions, orientation basis and acquisition method are browser-reported, not server-certified sensor metadata. The server verifies source authorization/hash, allowed transform shape, bounded actual upload size, derived checksum and JPEG frame dimensions. The API normalizes metadata to an allowed set; it cannot receive unrelated private notes. R2 objects are conditional immutable writes, and durable state follows an R2 head check. Retry keys bind the full intent. Scan failures do not block photo/voice preservation or manufacture a saved-scan claim.

Anonymous access requires the local draft capability. Claimed scans require the owner's account session for both metadata and pixels. Scans are not added to existing family artifacts or primary original IDs. Whole-draft deletion removes derived R2 objects and derivative/provenance rows before their originals. Derivatives are linked to the same Living Memory when its foundation is created.

## Steadiness and SureDose reference

Read-only reference: `sanlorenzoprx/suredose` at `0655e7df211ff54e4469bac26de4788bcd122dc4`, specifically `src/lib/image.ts` and `src/components/photo-capture.tsx`. The observed ideas were optional continuous autofocus, short-burst selection, light guidance and prompt canvas-memory release. No SureDose source, medical behavior, model, backend or compression policy is inherited. Memories: My Story's capture/scan code is independently implemented against its own invariants.

“Steady photo” is explicit software assistance: an optional short shutter delay and up to three still candidates, retaining the candidate with the strongest relative detail score as an unchanged original. Candidate count/selection is local capture metadata. A weak relative metric is not proof of sharpness, and no pixels are synthesized to undo blur. Support elbows or use a phone stand, keep the phone parallel to the print and use soft even light. Manual capture/import remains available.

Portable browser camera APIs do not provide a universal still-photo electronic/optical stabilization switch. The native device-camera path can use that camera app's stabilization; the web app cannot certify it. Do not label a best-shot selection as motion deblurring or claim stabilized sensor pixels. Actual tremor reduction, focus, glare, speed, orientation and memory behavior still require the owner's physical iPhone/Android checks.

## Retakes and milestone boundary

Inspection found that server promotion selected the first durable original of each role. Replacing an accepted photograph in the same draft could therefore select an older source. Accepted-photo retakes now create a new draft, preserving the prior source/scan and its recovery address. Pending callbacks from the old draft cannot replace the new route's state. This is a provenance repair; no original is rewritten or automatically deleted.

The expanded first-release matrix remains required. The owner confirmed MVP v0.5 includes two-person Our Living Legacy and all components of the V2 handoff. Continue the full expanded scope; do not require physical camera testing before the owner’s chosen implementation milestone or mark that evidence passed. See `../EXECUTION/MVP_V0_5.md` and the dated implementation receipt.
