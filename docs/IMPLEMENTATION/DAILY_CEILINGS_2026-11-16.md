# Per-account daily ceilings (L5.4, L7 cost ceilings)

**Result:** PARTIAL — implemented and locally proven; ceiling values need staging evidence.
**Base:** `main` `398f32b` (PR #71).
**Authority:** V1 launch handoff lane L5 item 4 (per-account and per-operation ceilings) and the L7 per-account cost ceilings.

## Outcome

Before any route runs, a signed-in request for a budget-spending operation is counted against that person's daily ceiling for that operation:

| Operation | Daily ceiling |
| --- | --- |
| Muse | 300 |
| Muse speech | 300 |
| Muse conversation | 300 |
| Voice replies | 100 |
| Transcription | 40 |
| Photograph scans | 60 |
| Shared-conversation calls | 20 |

Past the ceiling, the request gets `429 daily_limit_reached` with `Retry-After`. The person sees, in English or Spanish: "You have reached today's limit for this. Your memories are safe; please try again tomorrow."

## Promises protected

- **Preservation first:** uploads, saves, completion and reads are never counted, so a ceiling can never stop a memory from being preserved. A counter error lets the request through; per-address rate limits still apply.
- **Exact under concurrency:** the counter is raised only while under the ceiling, in one atomic statement, so concurrent requests cannot overshoot.
- **No content recorded:** only person, day, operation and count.
- **Originals stay retrievable:** nothing here limits reading or exporting one's own originals. The "plan lapses" case has no paid plan yet (D1).

## Change

- `migrations/0031_account_daily_usage.sql`.
- `worker/usage-ceilings.ts`: `ceilingOperation` and `enforceDailyCeiling`.
- `worker/index.ts`: applied after the rate limits, before routing.
- `config/phase-1.ts`: the `dailyCeilings` values.
- `app/localization/catalog/commerce.ts`: wording and Spanish.

## Evidence

| Check | Result |
| --- | --- |
| Integration `tests/integration/daily-ceilings.test.ts` | 2 pass: only budget-spending operations counted (uploads, completion and reads are not); refused past the ceiling for that person and operation only; another operation counted separately; no session falls through to address limits; a refused request is not counted |
| `npm run verify:core` | Pass — 337 tests in 80 files; schema 145 objects |
| Full phone-viewport suite locally | 81 pass; 9 not run (sandbox-only) |

**Reversible:** yes (raise the values). **Migration:** 0031. **Production deployed:** no.
