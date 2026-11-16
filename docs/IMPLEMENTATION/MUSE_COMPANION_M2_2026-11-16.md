# Talk with Muse M2 — where you left off, and what Muse remembers

**Result:** PARTIAL — implemented and proven with an in-memory database, stubbed browser runs and the automated accessibility scan. Not deployed; not tried with real people.
**Base:** `main` `2a778f9` (PR #80, M1).
**Authority:** `docs/DECISIONS/2026-11-16-talk-with-muse.md` (packet M2).

## Change

- **Muse's memory is the person's own confirmed words.**
  - It is the latest stated or approximate person, place, time and event on each of the person's Living Memories, already stored with its source. There is no separate store and nothing is inferred.
  - "I don't remember" and "I'd rather leave that out" are never remembered as facts.
  - Read by `readRemembered` in `worker/muse-memory.ts`.
- **Forgetting** (`migrations/0040_muse_memory.sql`):
  - `muse_memory_exclusions` records only what the person asked Muse to stop bringing up. The memory's own context is never changed.
  - A trigger lets only the memory's owner add a row. Deleting the context entry, the memory or the account removes the row.
- **Where you left off:** the most recently touched unfinished memory, and how many are unfinished. Expired and finished drafts are ignored.
- **Route** `GET /resources/muse/memory`:
  - returns where you left off, plus everything remembered, including forgotten items marked as such;
  - `POST /resources/muse/memory/forget` takes `X-Memories-Request: muse-memory-v1` and `{ contextEntryId, forgotten }`;
  - someone else's entry answers 404, exactly like one that does not exist.
- **Muse connects memories** (`worker/muse-conversation.ts`):
  - Muse's next question may gently ask whether this memory connects to up to 12 things the person confirmed in their other memories, never assuming it does.
  - Forgotten items are left out.
  - Those words count as the storyteller's own for the invented-name guard, so "Was Tío Luis with you too?" is allowed only when the person said "Tío Luis" somewhere.
  - If this read fails, Muse still asks a question without them.
- **Archive page** (`app/features/muse/MuseMemoryPanel.tsx`):
  - a "Pick up where you left off" card;
  - a "What Muse remembers" section grouped by people, places, times and moments, each linked to its memory, with "Ask Muse to forget" and "Let Muse remember". The change is shown only after the server confirms it.
  - English and Spanish copy in `catalog/muse.ts`.

## Evidence

| Check | Result |
| --- | --- |
| `tests/integration/muse-memory.test.ts` (5) | Latest value per kind with its memory and title; unknown is not remembered; forget and remember again leave the memory's context identical; one person cannot see or change another's (404, nothing recorded, and the database trigger refuses); 401 without a session, 400 for a wrong header or body; left-off picks the latest unfinished, ignoring expired and finished; Muse's prompt includes a remembered person but not a forgotten place; the guard allows that remembered name and would replace it if the name came from nowhere |
| `tests/e2e/muse-memory.spec.ts` (EN, ES) | Left-off link and count; grouped list with "About:" for approximate values and links to the memory; forget, then remember, each confirmed by the server with the right request header |
| `tests/e2e/accessibility.spec.ts` | The open panel is now scanned. A first run found tap targets under 24 px (WCAG 2.5.8); links and buttons now have full-size targets; 14 screens pass in EN and ES |

## Also in this change: Gemini called directly with the owner's key

The owner has Gemini credits with Google and asked for a direct call (decision amended 2026-11-16).
- With the Worker secret `GEMINI_API_KEY`, Muse calls `gemini-3-flash-preview` on Google's OpenAI-compatible endpoint, with low reasoning effort and a 15-second limit (`DirectGeminiMuseTextProvider`). Workers AI answers when Google refuses or is down.
- Without the key, the AI Gateway route is unchanged.
- `npm run eval:muse` accepts `GEMINI_API_KEY` alone, with no Cloudflare account needed.
- Tests (`tests/unit/muse-provider.test.ts`, 3 new):
  - Google is called directly with the key as a Bearer token, and the binding is not called;
  - Workers AI answers on 401, 429 and 500 from Google, and the key never appears in a failure;
  - a blank key keeps the gateway route.
- Not proven live: the model id and the reasoning setting are taken from Google's documentation and need the first evaluation run.

**Reversible:** yes. The table is additive; an older Worker ignores it. **Migration:** 0040. **Production deployed:** no.
