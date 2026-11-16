# Decision: Talk with Muse — a storytelling companion built for safety and global use

**Status:** Accepted (owner decisions 2026-11-16)
**Date:** 2026-11-16
**Changes:** `docs/FOUNDATION/06_AI_BEHAVIOR_GUIDE.md` (binding guide, version 0.2). It does not change any locked Product Invariant.

## Context

The owner asked whether Muse could go further: aware of where each person left off, of their unorganized photographs, and personal as their archive grows. In the owner's words, "something like an AI coach but geared towards story telling, understanding". It would be for people who "may be by themselves, family too busy or alienated or just more comfortable" talking about their digital legacy.

Today's Muse has no memory beyond one photograph. It sees only one memory's transcript. It never looks at the photograph. It does not know the person's other memories, earlier conversations, or where they stopped.

### Research reviewed on 2026-11-16

- **Older adults treat memory companions as relationships, not tools.** Memory Box (MeBo), CHI 2026, and its companion paper "Beyond Triggering Memories" (SSRN, 2026) found participants preferred companion personas over clinical ones. Photos worked as conversation anchors. Participants asked for legacy-building, emotional restraint, transparency and user control.
- **Photo-grounded questions should describe only what is visible.** Eye2Recall (ACM 2026, arXiv 2508.02232) prompts its model to describe only what can be seen in the photo, then ask about it.
- **Heavy voluntary use correlates with worse outcomes.** In a four-week MIT Media Lab and OpenAI randomized trial (981 people, arXiv 2503.17473), people who chose to use a chatbot more were lonelier, more dependent and socialized less. Small talk related to more dependence than personal conversation did. A 2026 meta-analysis of randomized trials found no reliable effect on loneliness.
- **Companion-chatbot laws define a companion by behaviour, not by name.**
  - New York's AI companion law has been in force since 2025-11-05. It covers a system that keeps a relationship going, remembers earlier conversations and raises personal matters. It requires telling people they are not talking to a human, repeatedly, and detecting self-harm and pointing to crisis services.
  - California SB 243 has been in force since 2026-01-01. It requires a self-harm protocol and forbids reward systems built to drive engagement.
  - The EU AI Act's rule that people must be told they are talking to an AI started applying in August 2026. This needs legal confirmation before an EU launch.

## Decision

In the owner's words: "initially US then global scale app so that has to be baked in from the start"; "product should be magical experience like the roadster"; "muse can look at the photo to help with questions"; "layer 4 i think we should start with it"; "use Gemini models initially".

1. **Name and framing.** Muse stays "Muse" and is described by what it does: it helps you tell your story. It is never marketed as a friend. A Muse that remembers a person meets the legal definition of a companion whatever it is called, so **every companion safeguard is built in from the first release, everywhere**:
   - **Muse says plainly that it is an AI.** It says so at the start of each conversation and again at least every three hours of continued conversation.
   - **Danger is answered first.** First-person signs of wanting to die or self-harm get a fixed, reviewed message with real people to reach now, in the person's language and country. The person's words are kept as testimony. The conversation stays open.
   - **No engagement rewards.** No streaks, badges, guilt prompts or free memories for time spent.
   - **Adults only.** Confirmed at sign-up for the open conversation.
   - **"What Muse remembers".** A page where the person sees, edits or erases everything Muse remembers about them.
   - **Long conversations end well.** After a long conversation, Muse gently suggests sharing a story with someone in the family rather than talking longer.
   - **Built for many countries.** Crisis lines, emergency numbers and language are configuration per country (`config/muse-safety.ts`). A country without an entry gets the global helpline directory, never silence.
2. **"Magical", applied as Musk's step 2 (delete before you add).** Muse has nothing to set up, speaks and listens naturally, and already knows where the person left off. Not built:
   - a separate chat app;
   - an avatar or customizable persona;
   - streaks or gamification;
   - an outside memory service. The archive, with its provenance, is Muse's memory.
3. **Muse may look at the photograph.**
   - It describes only what is visible and turns that into a question.
   - It never states a name, date, place or relationship as fact.
   - What it sees is stored as Muse-generated material, visibly separate from testimony (I-04, I-26).
4. **Start with the open conversation, built on the other layers.** "Talk with Muse" is the first surface, and it is grounded from day one:
   - it knows where the person left off;
   - it can bring a photograph into view and ask about it;
   - it remembers only the person's own confirmed words, with their source;
   - anything said about a photograph can become a Living Memory in the person's own voice.
5. **Models.** Gemini first, reached through the existing Workers AI binding and Cloudflare AI Gateway with unified billing, so there is no Google key to manage.
   - Only models Cloudflare lists as zero data retention may receive a family's words (`phase1Config.ai.museZeroRetentionModels`). The primary is `google/gemini-3-flash`.
   - Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast`) stays as the fallback, so Muse keeps listening during an outage.
   - The model choice is confirmed with the live evaluation (`npm run eval:muse`) before launch.
   - **Amended the same day.** The owner has Gemini credits with Google and asked for a direct call ("we need to do a direct call").
     - When the Worker secret `GEMINI_API_KEY` is set, Muse calls Google's Gemini API directly (`gemini-3-flash-preview` on Google's OpenAI-compatible endpoint), billed to the owner's Gemini credits. Workers AI stays the fallback.
     - The key must belong to a Google Cloud project with billing on. Under Google's Gemini API terms, paid-tier prompts and responses are not used to improve Google's products, while unpaid-tier content is.
     - Without the key, the AI Gateway route above remains, and it can also use a Google key stored on the gateway (BYOK) instead of Cloudflare credits.

## Order of work

| Packet | Content | Status |
| --- | --- | --- |
| M1 | This decision; Gemini routing with zero-data-retention allowlist and fallback; the danger check in today's Muse conversation and first question | Merged (PR #80) |
| M2 | Muse memory: "where you left off", the person's own confirmed people, places and times across memories, and the "What Muse remembers" page | Merged (PR #81) |
| M3 | Photo-aware questions (visible content only), stored as generated material | Merged (PR #82) |
| M4 | Talk with Muse: voice-first open conversation, adult confirmation, AI disclosure cadence, gentle ending, model-based second safety check | M4a server route merged (PR #83); M4c typed screen implemented (`IMPLEMENTATION/MUSE_COMPANION_M4C_2026-11-16.md`), confirmation wording awaiting owner review; M4b voice and saving planned |
| M5 | Live evaluation of Gemini models on synthetic scenarios; owner review of crisis wording before launch in each country | Needs the owner's Cloudflare credentials |

The first-five-minute experience (`2026-07-15-first-five-minute-experience.md`) is unchanged: Talk with Muse is never part of a new person's first three interactions.

## Alternatives considered

- **"Friend" framing.** Rejected. It claims a relationship. The research ties that to dependence. It makes Muse the centre, against I-15.
- **Outside memory frameworks (Mem0, Zep/Graphiti, Letta).** Not adopted. Published comparisons are confounded (MemDelta, 2026). The archive already holds the person's words with provenance, which a separate store would duplicate.
- **Open conversation only after the other layers.** Recommended first by the coordinator. The owner chose to start with it; this decision does so on top of the memory and photo layers.
- **Workers AI open models only (Gemma 4, Kimi K2.5).** Kept available. Gemini was chosen first by the owner. The routing accepts any Workers AI model and any listed zero-data-retention model.

## Affected Product Invariants

- **I-04 / I-26 (generated content distinguishable):** preserved. Photo descriptions and Muse's lines are stored and shown as Muse's.
- **I-05 / I-06 (no editorial correction; the storyteller owns meaning):** preserved. Muse remembers only confirmed words, never infers facts, and the person can erase what it remembers.
- **I-15 (technology stays in the background):** preserved by the "delete" list above and by no engagement rewards.
- **I-16 (Muse listens before asking):** preserved. The support message replaces a question; it never interrupts a recording.
- **I-18 (adapts to language):** extended to country-specific help.
- **I-19 (privacy-first):** preserved. Zero-data-retention models only; nothing Muse remembers is shared.

## Evidence required

- Unit tests:
  - the danger check: English and Spanish, first person, and memories *about* hard things that must not trigger it;
  - support wording per country and the global fallback;
  - model routing: gateway, zero-data-retention refusal, fallback.
- Integration tests:
  - a danger reply gets support with no model call;
  - the words are kept but not attached as context;
  - a retry does not duplicate the support message;
  - the conversation continues afterwards;
  - danger on the last answer, and danger in the recording itself, are both answered.
- Before launch: a live evaluation, an owner and legal review of crisis wording per country, and acceptance with real people (`ACCEPTANCE_KIT_V1.md`).
