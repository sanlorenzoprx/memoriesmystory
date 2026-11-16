# Talk with Muse M1 — Gemini routing and the danger check

**Result:** PARTIAL — routing and the danger check are implemented and proven with fakes and an in-memory database. Gemini has not been called live.
**Base:** `main` `cdef8f4` (PR #79).
**Authority:** `docs/DECISIONS/2026-11-16-talk-with-muse.md`.

## Change

- **Model routing** (`worker/providers/muse-provider.ts`, `worker/providers/model-output.ts`, `config/phase-1.ts`):
  - Muse now asks `google/gemini-3-flash` first. The call goes through the existing `AI` binding and AI Gateway (`AI_GATEWAY_ID`, default `default`) with unified billing.
  - A third-party model not on the zero-data-retention list is refused without being called.
  - Workers AI `@cf/meta/llama-3.1-8b-instruct-fast` answers when Gemini fails or answers nothing. If both fail, Muse uses its fixed question as before.
  - Replies are read in both the Workers AI and Chat Completions shapes.
- **Danger check** (`worker/muse-safety.ts`, `config/muse-safety.ts`):
  - It looks for first-person, present-tense English and Spanish statements of wanting to die or self-harm.
  - Support wording is fixed per country: US and Puerto Rico get 988 and 911; anywhere else gets findahelpline.com and the local emergency number.
  - It is wired into the existing Muse conversation (`worker/muse-conversation.ts`) for each reply, for the recording itself on the first turn, and for retries. It is also wired into the first Muse question (`worker/muse.ts`).
  - The words are kept as a storyteller turn and never saved as person, place, time or event context. No model is called for the support message.
- **Interface** (`app/features/living-memory/MuseSupportLines.tsx`): one-tap Call, Text and Emergency links under the support message, in English and Spanish (`catalog/muse.ts`).
- **Evaluation** (`scripts/muse-eval.ts`): defaults to Muse's configured model; Gemini goes through the AI Gateway REST API.

## Evidence

| Check | Result |
| --- | --- |
| `tests/unit/muse-safety.test.ts` | 14 danger statements detected (English and Spanish, including accented word boundaries) and 8 memories about hard things not flagged. Support wording by country and the global fallback checked |
| `tests/unit/muse-provider.test.ts` | Gemini called with the gateway and the reasoning-token allowance; default gateway; Workers AI fallback on outage or empty reply; error when all models fail; a non-listed third-party model refused uncalled |
| `tests/integration/muse-conversation.test.ts` | Spanish reply of danger answered with 988 and 911 and no model call; words kept, no context saved; retry does not duplicate; next reply gets a normal question; danger on the would-be final answer still answered; danger in the recording answered on the opening turn |
| `npm run verify:core` | Pass — 383 tests in 85 files |

Writing the integration test exposed a gap: "I think about ending my life" was not detected. The fix requires first person for "thought about suicide", so a memory such as "my mother once thought about suicide" stays testimony.

## Not yet proven

- **Live Gemini behaviour** (latency, how many reasoning tokens it uses, question quality). Needs the owner's Cloudflare credentials and AI Gateway credits for `npm run eval:muse`.
- **The danger check is a narrow keyword floor**, not a clinical tool. M4 adds a model-based second check. The crisis wording needs owner and legal review before launch in each country.

**Reversible:** yes. Set `museModelId` back to a `@cf/` model. **Migration:** none. **Production deployed:** no.
