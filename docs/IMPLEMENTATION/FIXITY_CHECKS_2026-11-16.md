# Scheduled integrity (fixity) checks (A5, L3.2)

**Result:** PARTIAL — implemented and locally proven; CI and staging evidence pending.
**Base:** `main` after PR #62.
**Authority:** V1 launch handoff, group A item A5 (lane L3, packet 3).

## Outcome

Once a day, a scheduled pass re-reads up to 100 stored files and re-hashes each with SHA-256, up to 2 GiB per pass. Files never checked come first, then the files checked longest ago. Each file's result is compared with the hash and size recorded when it was preserved, and saved as one append-only row:
- **match**: the hash and size are unchanged;
- **mismatch**: the object's bytes or size differ;
- **missing**: the object is gone.

A mismatch or missing object is logged with its kind, id and outcome only, never content, so an alert can be built on it in L7's observability work.

The pass covers original photographs and voices, derived files, Muse voice replies, relatives' voice and photo recollections, in-person shared-conversation recordings, and remote recording sources.

## Promises protected

- **Originals are immutable and provable:** silent storage corruption or loss is detected and recorded instead of discovered years later. The check never repairs, rewrites or deletes an object. A test compares every stored byte before and after a pass.
- **Deletion means deletion:** deleting a memory deletes its integrity rows in the same transaction, so no hash of deleted family media remains.
- **No content in logs.**

## Change

- `migrations/0025_fixity_checks.sql`: the `fixity_checks` table, rejecting updates; a match must record the expected hash.
- `worker/fixity.ts`: `runFixityPass`. It streams each object through `crypto.DigestStream` in the Worker, so a long recording does not need to fit in memory.
- `worker/index.ts`: a `scheduled` handler.
- `wrangler.jsonc`: cron `37 7 * * *` (daily, UTC).
- `worker/deletion.ts`: removes integrity rows for each deleted file.
- `scripts/verify-d1-schema.mjs` and the hand-listed test migration sets include 0025.

## Evidence

| Check | Result |
| --- | --- |
| Integration `tests/integration/fixity.test.ts` | 3 pass: match, changed and missing recorded, with objects byte-identical afterwards; never-checked first, then oldest; append-only; byte budget respected; a "match" with a different hash refused |
| Integration `memory-deletion.test.ts` | Deleting a memory removes its integrity rows and keeps another's |
| `npm run verify:core` | Pass — 305 tests in 71 files; schema 121 objects |
| Staging cron run | NOT_RUN |

## Deferred, with reason

- **Dead-letter queue:** a dead-letter queue must exist in Cloudflare before a deploy that names it. It is added to the L8 provisioning list instead of the config, so deploys are not blocked. A failed transcription already leaves an honest "failed" state that the person can retry.
- **Backup and restore rehearsal** (the rest of A5) belongs to L8, with staging.

**Reversible:** yes (remove the cron; the table is inert). **Migration:** 0025. **Production deployed:** no.
