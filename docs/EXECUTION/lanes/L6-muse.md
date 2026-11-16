# L6 — Muse quality

**Scope:** Evaluation corpus and evaluator; model comparison; measured fixes only.
**Migration numbers:** none
**Owns:** tests/fixtures/muse/, tests/eval/, worker/providers/muse-provider.ts (routing only)

The lane updates this file in each pull request. The coordinator folds it into `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `CHANGELOG.md` at merge. Lanes do not edit those three files.

## Status

In progress. B01 corpus and evaluator, the live runner, and B03 measured guard fixes implemented by the coordinator, CI pending. The B02 live comparison needs the owner's account credentials.

## Merged

None yet.

## Evidence level reached

B01/B03: UNIT_PROVEN offline (receipt `docs/IMPLEMENTATION/MUSE_EVALUATION_2026-11-16.md`). Live run: not run.

## Next

Run `npm run eval:muse` with the owner's credentials; compare with `--model=`; record the result ("no change" is valid).

## Waiting on the owner

- Cloudflare account id and an API token with Workers AI access, used only in the owner's own shell for `npm run eval:muse`.
