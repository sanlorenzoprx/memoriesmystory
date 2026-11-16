# L6 — Muse quality

**Scope:** Evaluation corpus and evaluator; model comparison; measured fixes; Talk with Muse packets M1–M5 (`docs/DECISIONS/2026-11-16-talk-with-muse.md`).
**Migration numbers:** 0040 (allocated by the coordinator)
**Owns:** tests/fixtures/muse/, tests/eval/, worker/providers/muse-provider.ts, worker/providers/model-output.ts, worker/muse-safety.ts, config/muse-safety.ts, app/localization/catalog/muse.ts, worker/muse-memory.ts, app/features/muse/

The lane updates this file in each pull request. The coordinator folds it into `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `CHANGELOG.md` at merge. Lanes do not edit those three files.

## Status

In progress. B01 corpus and evaluator, the live runner, and B03 measured guard fixes merged (PR #76, `0d677a5`). M1 (Gemini routing, zero-data-retention allowlist, Workers AI fallback, danger check) merged (PR #80, `2a778f9`). M2 (where you left off, what Muse remembers, connecting memories) in review. The B02/M5 live comparison needs the owner's account credentials.

## Merged

- B01/B03 evaluator, live runner and guard fixes — PR #76, `0d677a5`.
- M1 Gemini routing and danger check — PR #80, `2a778f9`.

## Evidence level reached

B01/B03: UNIT_PROVEN offline (receipt `docs/IMPLEMENTATION/MUSE_EVALUATION_2026-11-16.md`). Live run: not run.
M1: INTEGRATION_PROVEN with fakes (receipt `docs/IMPLEMENTATION/MUSE_COMPANION_M1_2026-11-16.md`); Gemini not called live.
M2: INTEGRATION_PROVEN plus stubbed browser and accessibility runs (receipt `docs/IMPLEMENTATION/MUSE_COMPANION_M2_2026-11-16.md`); migration 0040.

## Next

M3 photo-aware questions (visible content only, stored as generated material). Then M4 Talk with Muse. Run `npm run eval:muse` (default now Gemini) with the owner's credentials; compare with `--model=`; record the result.

## Waiting on the owner

- Cloudflare account id and an API token with Workers AI and AI Gateway access, plus AI Gateway credits (unified billing) for Gemini, used only in the owner's own shell for `npm run eval:muse`.
- Review of the crisis wording and numbers per launch country (`config/muse-safety.ts`).
