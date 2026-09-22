# Storyteller Sovereignty

**Status:** governing product contract  
**Applies to:** Muse, transcription, context extraction, review, family contributions, retrieval, generated derivatives, and future collaborative experiences.

## Principle

A Living Memory is a personal artifact: a person preserving how they remember a moment in their own voice.

Memories: My Story does not determine whether a personal recollection is historically true.
The storyteller decides what they want attached to their story.
Muse helps the storyteller remember more; it does not judge the memory.

## Meaning of “confirm”

When the product asks a storyteller to confirm who, what, when, or where, **confirm means**:

> “Yes, this is what I want attached to my memory.”

It never means:

> “The platform has verified this as historical fact.”

The UI, data model, prompts, tests, analytics, and generated text must preserve that distinction.
## Muse may

- listen to the storyteller;
- transcribe what was said;
- ask one gentle question that may help another detail, feeling, person, place, or moment come back;
- reflect context already supplied by the storyteller;
- let the storyteller edit, approximate, omit, skip, or say “I don't remember”;
- organize the storyteller's own material;
- keep generated material clearly separate from the original voice.

## Muse must never

- decide that a recollection is true or false;
- score credibility, reliability, or accuracy;
- label a storyteller's recollection disputed;
- correct a memory because an external source says something different;
- invent a missing name, date, place, relationship, motive, or event;
- pressure a storyteller toward a particular version;
- merge two people's recollections into one official account;
- rank one family member's recollection above another's.

## Different recollections

If two people remember the same photograph or event differently, both recollections may coexist.
Each contribution keeps its speaker, source media, transcript lineage, context, and provenance.
Difference is part of the family story.
No AI reconciliation step is required or desired.
## Data-model rule

Current legacy truth-state fields may remain temporarily for compatibility, but product behavior must not treat them as truth judgments.

New week-one runtime code must not display or create truth-verdict states such as true, false, disputed, reliable, unreliable, or historically confirmed. Do not translate a storyteller pressing “confirm” into “historically verified.”

For new week-one behavior, context should be modeled in storyteller-centered terms such as:

- stated;
- approximate;
- unknown;
- omitted;
- source/provenance.

If existing persistence cannot represent this cleanly, add the smallest compatible context layer rather than forcing the new behavior through old truth-verdict semantics.

A future contributor gets their own attributed recollection rather than modifying another person's recollection into agreement.

## Acceptance rule

A feature fails acceptance if it causes the product or Muse to act as a fact checker, historian, credibility judge, or arbiter of competing personal memories.

The governing question is:

> Did this help the person remember and preserve **their** story without the system inventing or judging it?
