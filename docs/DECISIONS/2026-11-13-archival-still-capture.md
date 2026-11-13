# Archival still acquisition before corrected scans

**Date:** 2026-11-13  
**Authority:** owner explicitly requested continuation with native-resolution still photos and reliable fallbacks, preparing untouched sources for separately stored perspective-corrected scans.  
**Status:** implementation slice; physical-phone acceptance and corrected scans remain pending.

Build from merged main `cb87c5656c9994ec0b0fabd1ebf93762888cc2ac` after PR #23. Keep the pending solo physical-device/human checkpoint visible while developing this bounded source-acquisition branch. This does not accept that checkpoint or authorize production deployment.

Offer a device-camera picker with `capture="environment"`, retaining ordinary import. This is a browser hint; the browser may offer a camera or library, and the app must not assert sensor-native resolution or actual camera origin from the hint alone. Preserve the returned file byte for byte.

For the guided camera, prefer `ImageCapture.takePhoto`. Request maximum reported still dimensions where available, retry device-default settings when maximum settings fail, and bound capability/still requests so an unsupported API cannot hang indefinitely. If still capture is unavailable, use the actual video-frame dimensions and visibly identify that fallback. Request a higher-resolution environment-facing preview using ideal constraints; actual resolution remains device-selected. No upscaling, generative cleanup or source rewriting.

Keep all entry paths behind deliberate actions. Camera cancellation invalidates pending responses, aborts application waiting, and stops tracks, including tracks granted after cancellation/unmount. A late still cannot overwrite an imported replacement. Concurrent shutter actions are blocked. Ordinary import remains available during guided-camera entry, denial and live preview.

Retain decoded dimensions, browser-decoded orientation, acquisition method and SHA-256 with the local source. Do not invent acquisition metadata for older drafts. Browser-decoded orientation is not an independently parsed EXIF/sensor-orientation claim. The current upload path continues preserving the same original bytes. Durable metadata/export linkage belongs to the following derived-scan slice; local acquisition metadata alone does not establish cross-device provenance.

Use a centrally configured preferred shortest edge of 1800 pixels for practical snapshot guidance. This is a proxy, not a verified DPI or sharpness claim. Low resolution invites a device-camera/larger-file retry rather than claiming that moving closer changes pixel dimensions. Every quality warning retains manual acceptance. File-size/type constraints apply equally to imports, device files, still blobs and video-frame captures; never silently shrink a captured still to fit a limit. Image-element decoding can recover when bitmap decoding is unsupported for a format.

All added controls and guidance ship in English and Spanish. Foundation promises remain unchanged: original image first, separate derivatives, private by default, truthful local/durable states and skippable guidance. Perspective/corner correction, corrected-scan persistence/provenance/deletion and physical print evidence remain required in R1; this slice does not claim them.
