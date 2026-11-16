# L6 — Muse quality

**Scope:** Evaluation corpus and evaluator; model comparison; measured fixes; Talk with Muse packets M1–M5 (`docs/DECISIONS/2026-11-16-talk-with-muse.md`).
**Migration numbers:** 0040–0042 (allocated by the coordinator)
**Owns:** tests/fixtures/muse/, tests/eval/, worker/providers/muse-provider.ts, worker/providers/model-output.ts, worker/muse-safety.ts, config/muse-safety.ts, app/localization/catalog/muse.ts, worker/muse-memory.ts, worker/muse-photo.ts, worker/muse-talk.ts, app/features/muse/

The lane updates this file in each pull request. The coordinator folds it into `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `CHANGELOG.md` at merge. Lanes do not edit those three files.

## Status

In progress. B01 corpus and evaluator, the live runner, and B03 measured guard fixes merged (PR #76, `0d677a5`). M1 (Gemini routing, zero-data-retention allowlist, Workers AI fallback, danger check) merged (PR #80, `2a778f9`). M2 and the direct Gemini call merged (PR #81, `d06c0d2`). M3 (Muse looks at the photograph) merged (PR #82, `a3b0181`). M4a (Talk with Muse server route) merged (PR #83, `99091e3`). M4c (the typed screen) in review. The B02/M5 live comparison needs the owner's account credentials.

## Merged

- B01/B03 evaluator, live runner and guard fixes — PR #76, `0d677a5`.
- M1 Gemini routing and danger check — PR #80, `2a778f9`.
- M2 what Muse remembers, and the direct Gemini call — PR #81, `d06c0d2`.
- M3 Muse looks at the photograph — PR #82, `a3b0181`.
- M4a Talk with Muse server route — PR #83, `99091e3`.

## Evidence level reached

B01/B03: UNIT_PROVEN offline (receipt `docs/IMPLEMENTATION/MUSE_EVALUATION_2026-11-16.md`). Live run: not run.
M1: INTEGRATION_PROVEN with fakes (receipt `docs/IMPLEMENTATION/MUSE_COMPANION_M1_2026-11-16.md`); Gemini not called live.
M2: INTEGRATION_PROVEN plus stubbed browser and accessibility runs (receipt `docs/IMPLEMENTATION/MUSE_COMPANION_M2_2026-11-16.md`); migration 0040.
M3: INTEGRATION_PROVEN with fakes (receipt `docs/IMPLEMENTATION/MUSE_COMPANION_M3_2026-11-16.md`); migration 0041.
M4a: INTEGRATION_PROVEN with fakes (receipt `docs/IMPLEMENTATION/MUSE_COMPANION_M4A_2026-11-16.md`); migration 0042.
M4c: BROWSER_PROVEN against a stubbed server (receipt `docs/IMPLEMENTATION/MUSE_COMPANION_M4C_2026-11-16.md`).

## Next

M4b voice and "Save as a Living Memory"; a model-based second safety check; conversations in the export. Run `npm run eval:muse` (default now Gemini) with the owner's credentials; compare with `--model=`; record the result.

## Waiting on the owner

- A Gemini API key from a Google Cloud project with billing on (paid tier), entered by the owner as the Worker secret `GEMINI_API_KEY` and used in the owner's own shell for `GEMINI_API_KEY=… npm run eval:muse`. Never paste it in chat or commit it.
- Review of the crisis wording and numbers per launch country (`config/muse-safety.ts`).
- Approval of the Talk with Muse confirmation wording (receipt M4c), then legal review (D2).
