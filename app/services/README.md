# Services

Place real storage, transcription, image-processing, sharing, workflow, and notification boundaries here. A provider interface is justified only by an actual fallback, isolation, or replacement need.

Packet 1 includes the deterministic private R2 object-key boundary. Packet 2 adds the real browser-only IndexedDB draft store and local photo inspection boundary.

Packet 3 adds the browser media-durability client, audio-capture boundary, and ordered background synchronization service. Accepted originals remain recoverable in IndexedDB, retry with stable identities, and synchronize photograph before voice without blocking storytelling. Worker-side R2 transport, validation, scoped authorization, idempotent receipts, and streaming live in `worker/media-routes.ts`; browser code never receives R2 credentials or a public bucket URL.
