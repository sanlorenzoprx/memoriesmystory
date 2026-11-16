# "Something new is waiting" notices to invited family (A3, L2.4)

**Result:** PARTIAL — implemented and locally proven with a test double; nothing is sent until O2 (sending domain) and `PUBLIC_APP_ORIGIN` are set.
**Base:** `main` after PR #65.
**Authority:** owner decision 2026-11-15 (email to invited family with a direct link, as a growth path); V1 launch handoff lane L2 item 4.

## Outcome

Once a day, together with the integrity pass, an invited relative gets a short email in English and Spanish when all of these hold:
- they turned on "Email me when something new is shared with me";
- their access is still accepted; and
- since they joined and since their last notice, the owner has either placed a memory into a Chapter or album shared with them, or included for family someone else's recollection on a memory they can see.

The email says something new was shared and links to `/family`. It carries a one-step unsubscribe link and the `List-Unsubscribe` / `List-Unsubscribe-Post` one-click headers. A person gets at most one notice a day.

## Promises protected

- **No memory content in email:** never a title, album or Chapter name, words, photograph, or anyone's name. Tested against each of those values.
- **Consent:** sent only to people who opted in; one click stops it; nothing is sent about a person's own recollection.
- **Least privilege:** only news inside the accepted scope counts. Revoked access, or items from before the person joined, send nothing.
- **No noise while off:** when sending is off or the public origin is unset, the pass returns a stable code and records nothing.
- **No reward for sharing:** nothing is counted or credited.

## Change

- `migrations/0024_family_update_notices.sql`.
- `worker/notifications.ts`: `familyUpdateEmail` and `runFamilyUpdatePass`.
- `worker/index.ts`: the scheduled handler also runs the family update pass, logging counts only. `Env` gains `PUBLIC_APP_ORIGIN`, which is not set yet (L8 provisioning list).

## Evidence

| Check | Result |
| --- | --- |
| Integration `tests/integration/family-update-notices.test.ts` | 5 pass: off records nothing; one notice with link, unsubscribe headers and no content; once a day and not again without news; silent without opt-in, for items from before joining, and after revocation; included recollections count, the person's own do not; missing origin refuses |
| `npm run verify:core` | Pass — 320 tests in 75 files; schema 133 objects |
| Real send | NOT_RUN — needs O2 |

**Reversible:** yes. **Migration:** 0024. **Production deployed:** no.
