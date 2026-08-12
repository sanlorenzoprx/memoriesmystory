# Living Memory Public Copy Standard V1

**Status:** current public-facing copy standard  
**Date:** 2026-08-12  
**Applies to:** landing page, onboarding, offer/pricing copy, Muse-facing explanations, Memory Circle explanations, share prompts, FAQs, and other customer-facing product language

## 1. Purpose

Memories: My Story should sound clear, warm, human, and easy to understand on the first read.

The product can be sophisticated underneath. The customer should not have to decode sophisticated language to understand it.

The goal is not to make the writing childish. The goal is to make the meaning obvious.

## 2. Reading-level rule

**Target:** approximately grade 6–7 reading level for normal customer-facing copy.  
**Maximum:** grade 8 for ordinary marketing and product explanations, except where a necessary legal, medical, technical, research, or branded term requires something harder.

Do not optimize mechanically for the lowest possible grade score. A grade-5 target can make emotional copy sound clipped or patronizing. Prefer natural adult language that a typical middle-school reader can understand without losing the meaning.

When a necessary harder word appears, explain it in plain language nearby.

## 3. The clarity test

Before publishing customer-facing copy, ask:

> Could a person understand what this means without already knowing our product vocabulary?

If not, rewrite it.

A second test:

> If I read this sentence aloud to my mother, daughter, or neighbor, would I need to explain what I meant?

If yes, the sentence is too abstract.

## 4. Sentence rules

Prefer:

- one main idea per sentence;
- active voice;
- concrete nouns and verbs;
- short paragraphs;
- familiar words;
- the person, photograph, voice, story, and family as the subject;
- examples before abstractions;
- direct statements before qualifications.

Typical guidance:

- most sentences: about 10–18 words;
- most paragraphs: 1–3 sentences;
- avoid strings of three or more abstract nouns;
- do not stack multiple clauses merely to sound complete;
- break a long explanation into two sentences before shrinking the font.

## 5. Keep context inside the sentence

Do not shorten a sentence so much that the reader loses the human meaning.

Bad:

> Source-grounded preservation with attributed contributions.

Better:

> We keep the original photo and voice. If family members add memories, each person's words stay with their name.

Bad:

> Privacy-scoped sharing creates a bounded artifact.

Better:

> Your Living Memory starts private. When you share, you choose the photo, voice, and words that leave your Family Archive.

Clarity is not fewer words at any cost. Clarity is enough familiar words to preserve the meaning.

## 6. Public words versus internal words

Internal engineering, research, legal, and product-control vocabulary may remain precise. Customer-facing copy should translate it.

| Internal / specialist wording | Customer-facing wording |
| --- | --- |
| mechanism | how it works |
| premise proof | why this makes sense |
| source-grounded | based on the original photo and voice |
| source authenticity | your original photo and voice stay the source |
| provenance | where the memory came from / who added it |
| attributed recollection | each person's memory stays with their name |
| alternate recollections | family members can remember it differently |
| affect / affective information | emotion / feeling in a person's voice |
| autobiographical memory | personal memory |
| collaborative remembering | remembering together |
| bounded Share Artifact | a copy you choose to share |
| derivative story | a story created from your original memories |
| retrieval | find the memory again |
| archive continuity | keep the family's memories together over time |
| entitlement | what is included |
| source voice duration | how long you can record |
| product-led conversion | try one Living Memory free |

Do not expose implementation terms simply because they are correct internally.

## 7. Branded words that stay

These customer-facing terms may remain because they name simple, memorable product concepts:

- **Living Memory** — a photograph kept together with the real voice and story behind it;
- **Muse** — the gentle helper that listens, transcribes, organizes, and asks useful questions;
- **Memory Circle** — family or friends remembering together around one photograph, in the same room or from anywhere;
- **Chapter** — a group of Living Memories from one meaningful part of a life;
- **Life** — Living Memories and Chapters across one person's life;
- **Family Archive** — the family's connected collection of Living Memories.

The first time a branded term appears in a major flow, show what it means in plain language instead of assuming recognition.

## 8. Landing-page copy rules

The landing page should sound like one person explaining the idea to another person.

Prefer lines such as:

> A photograph shows the moment. Their voice tells you what it meant.

> Pick one photograph. Tell the story in your own words.

> Muse can help with the rest.

> Your first Living Memory is free.

> Some stories are better remembered together.

> Sit together at the kitchen table—or join from across the country.

> Your Living Memory starts private. You choose when to share it.

> Preserve more of the life between the dates.

Avoid visible marketing copy such as:

> Increase perceived likelihood through mechanism demonstration.

> Source-grounded family contribution and retrieval.

> Research-supported premises validate the product mechanism.

Those concepts may govern the work internally, but they are not customer language.

## 9. Public proof wording

Research copy must stay truthful and plain.

Prefer:

### Pictures can help bring personal memories back.

> Research has found that pictures and visual cues can affect how people remember events from their own lives.

### A voice carries more than words.

> A person's voice can carry identity and emotion, not just the words being spoken.

### Families often remember by talking together.

> People can remember different parts of the same event. Talking together can bring out details one person may not remember alone.

Use a quiet **See the research** link or footnote for the technical source. Do not force research vocabulary into the main reading path.

Never imply that this research proves Memories: My Story improves memory, health, family relationships, or well-being.

## 10. CTA language

CTA copy should say what happens next.

Preferred:

- **Create Your First Living Memory**
- **Try One Living Memory Free**
- **Give One Photo Its Voice**
- **Hear a Living Memory**
- **Start With One Photo**
- **See How Memory Circle Works**
- **Preserve a Chapter**
- **Preserve a Life**
- **Build Your Family Archive**

Avoid vague CTAs such as **Learn More**, **Explore**, **Discover**, or **Get Started** when a clearer action is available.

## 11. Readability review before code ships

For public copy, reviewers should check:

1. Can the main meaning be understood on one read?
2. Is the reading level generally grade 6–7 and no harder than grade 8 without good reason?
3. Does each sentence preserve enough context to make sense by itself?
4. Are internal product or research terms translated into ordinary words?
5. Can the important text be read aloud naturally?
6. Does the copy sound respectful to an adult rather than simplified for a child?
7. Are paragraphs short enough to scan without becoming fragments?
8. Does the wording keep the person, voice, photograph, story, and family at the center?

Readability scoring may later be added as an automated warning for public copy, but a score must never override human review for meaning, dignity, or emotional tone.
