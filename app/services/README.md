# Services

Place real storage, transcription, image-processing, sharing, workflow, and notification boundaries here. A provider interface is justified only by an actual fallback, isolation, or replacement need.

Packet 1 includes the deterministic private R2 object-key boundary. Packet 2 adds the real browser-only IndexedDB draft store and local photo inspection boundary.

R2 transport, upload validation, authorization, and streaming belong to Packet 3; their absence must not be disguised by an in-memory provider or a local-only “saved” claim.
