# Muse evaluation and measured guard fixes (L6, B01–B03)

**Result:** PARTIAL — offline evaluation implemented and passing; the live model run needs the owner's Cloudflare account credentials in their own shell.
**Base:** `main` `de18623` (PR #75).
**Authority:** V1 launch handoff lane L6; `docs/FOUNDATION/06_AI_BEHAVIOR_GUIDE.md`; Product Invariant I-12 (Muse listens before asking).

## What was built

- **B01 corpus:** `tests/fixtures/muse/scenarios.json`. Synthetic English and Spanish (Puerto Rico) scenarios, each with plausible raw model answers, good and bad. No real family data.
- **B01 evaluator:** `tests/eval/muse-invariants.ts`, written independently of the Worker's guard. A question a storyteller sees must:
  - be exactly one short question, with no preamble;
  - never judge, fact-check or doubt the memory, in English or Spanish;
  - introduce no name, place or number the storyteller did not say;
  - be in the storyteller's language.
- **B01/B02 live run:** `npm run eval:muse` (`scripts/muse-eval.ts`) sends only the synthetic transcripts to Workers AI with Muse's real prompt and guard. It reports raw and shown answers, violations, fallbacks and latency (p50, p95). `--model=` compares another model, and "no change" is a valid result. It refuses to run without credentials and sends nothing.

## What the evaluation found (before the fix)

Run against the existing guard, the corpus showed four kinds of failure reaching a storyteller:

1. **Spanish judgment passed.** "¿Estás seguro de que era en Ponce?", "¿Realmente era el traje de tu abuelo?" and "¿Es correcto que era una playa…?" all passed, because the judgment filter was English-only.
2. **Preambles passed:** "Here's a question: what did Rosa sing…?"
3. **Invented names passed.** "St. Mary's" and "Luquillo" appeared though the storyteller never said them.
4. **Wrong language passed** for a Spanish storyteller given an English question, and the reverse.

## Measured fixes (B03)

`worker/muse-guard.ts` (extracted from `worker/muse.ts`, behaviour otherwise unchanged) now turns each of those into the gentle fallback question:
- Spanish judgment forms are added;
- preambles are refused;
- names and numbers are checked against the storyteller's own words: the transcript, their conversation turns and their stated context, never Muse's earlier questions;
- language is checked against the storyteller's locale.

Muse's prompt wording is unchanged, so `musePromptVersion` is unchanged. The prompt now lives in `worker/muse-prompts.ts`, so the evaluation always tests the same words.

## Evidence

| Check | Result |
| --- | --- |
| Unit `tests/unit/muse-eval.test.ts` | 8 pass: the evaluator catches each failure kind; every candidate in every scenario reaches the storyteller only as a question with no violations; fallbacks pass; good questions pass through unchanged |
| `npm run verify:core` | Pass — 348 tests in 82 files |
| Full phone-viewport suite locally | 83 pass |
| Live model run | NOT_RUN — needs `CLOUDFLARE_ACCOUNT_ID` and an API token in the owner's shell |

**Reversible:** yes. **Migration:** none. **Production deployed:** no.
