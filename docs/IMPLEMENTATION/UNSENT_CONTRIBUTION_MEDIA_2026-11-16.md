# Reload-safe unsent contribution media (L1.3)

**Result:** PARTIAL — implemented and locally proven in the browser; real-device acceptance pending.
**Base:** `main` `371fd79` (PR #73).
**Authority:** V1 launch handoff lane L1 item 3.

## Outcome

A relative's written words already survived a reload. Now an unsent **voice recording** and an unsent **photograph** do too: they are kept on the device in IndexedDB, keyed by the person's draft scope for that memory. Each keeps its **request key**, so a send after a reload is the same request as the one before it and the server cannot store it twice.

They are removed when:
- the server confirms the send (the canonical record is read back);
- the person discards or replaces the item;
- the memory is deleted. The deletion is announced to every open tab, and also runs after a confirmed whole-memory deletion on this device.

## Promises protected

- **Nothing a person recorded is lost to a reload or a dropped connection.**
- **Truthful saved state:** "saved" still appears only after the canonical read-back; a kept item is never shown as saved.
- **Deletion means deletion:** deleting the memory clears kept media on the device as well.

## Change

- New `app/services/contribution-media-store.ts`, following `legacy-recording-store.ts`.
- `app/features/family-archive/FamilyContributionsPanel.tsx`: recovers on open, keeps on change, records the request key before sending, clears on success, discard and deletion.
- `app/services/memory-deletion.ts`: clears kept media after a confirmed deletion.

## Evidence

| Check | Result |
| --- | --- |
| Browser `tests/e2e/family-unsent-media.spec.ts` (EN, ES) | The recording and photograph survive a reload; a send after the reload reuses the recording's request key; a deletion message clears both |
| `npm run verify:core` | Pass — 337 tests in 80 files |
| Full phone-viewport suite locally | 83 pass; 9 not run (sandbox-only) |

**Reversible:** yes. **Migration:** none. **Production deployed:** no.
