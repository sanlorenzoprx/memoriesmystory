# HEIC viewing copy (L1.4)

**Result:** PARTIAL — implemented and unit-proven; live conversion needs the Cloudflare Images binding on staging.
**Base:** `main` `095e3a5` (PR #74).
**Authority:** V1 launch handoff lane L1 item 4: "A separate derived JPEG for display only; the original stays. Proof: original hash unchanged; derivative points to its source."

## Outcome

iPhones save photographs as HEIC by default, and most browsers apart from Safari cannot show it. When the memory page displays a preserved photograph, it asks for `?display=jpeg`. For a HEIC or HEIF original, the Worker then returns a JPEG made by the Cloudflare Images binding, labelled:
- `X-Viewing-Copy-Of: <original id>`;
- `X-Source-SHA256: <original hash>`.

It never carries the original's `X-Content-SHA256`, so the copy cannot be mistaken for the original. For every other format, or when the binding is missing, the input is over 20 MB, or conversion fails, the original is served exactly as before. Downloads, exports and integrity checks always use the original.

## Design choice

The copy is made on request and not stored. Storing it would have needed a new `media_assets` role, which means rebuilding that table under its immutability triggers. Nothing new is kept, so there is nothing extra to delete or check.

The trade-off is a transformation per view, billed by Cloudflare Images. If views grow, a stored copy can follow under a decision.

## Change

- `worker/private-media.ts`: `viewingCopyResponse` and the narrowed `ViewingImagesBinding` type.
- `worker/media-routes.ts`: uses it for the owner's media route. `MediaRouteEnv` and `Env` gain an optional `IMAGES`.
- `app/services/display-url.ts`, and the memory page's photograph images.
- L8 provisioning: add `"images": { "binding": "IMAGES" }` to `wrangler.jsonc` once Images is enabled on the account.

## Evidence

| Check | Result |
| --- | --- |
| Unit `tests/unit/viewing-copy.test.ts` | 3 pass: labelled JPEG for display; the original's stored bytes unchanged; never presented as the original; the original served as before without the parameter, without the binding, for PNG, and on a failed conversion; display parameter added only to the app's own media addresses |
| `npm run verify:core` | Pass — 340 tests in 81 files |
| Full phone-viewport suite locally | 83 pass |
| Live HEIC conversion | NOT_RUN — needs the Images binding on staging |

**Reversible:** yes. **Migration:** none. **Production deployed:** no.
