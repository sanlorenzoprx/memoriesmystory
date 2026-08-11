# Living Memory — Canonical Product Definition

**Status:** approved product contract  
**Date:** 2026-08-11

## Definition

A **Living Memory** is the canonical unit of value in Memories: My Story.

It is a source photograph or other captured moment preserved together with the authentic human voice, story, context, people, place, time, relationships, family contributions, provenance, truth state, and resurfacing potential that give the source meaning.

A Living Memory is not merely a media bundle. It is an attributable, durable, enrichable record of how people remember a moment.

## Canonical composition

A Living Memory may contain:

- original photograph or source media;
- original human voice;
- verbatim or machine transcript with revision lineage;
- narrator and contributor attribution;
- people and relationships;
- place;
- date or approximate date;
- event and themes;
- confirmed, approximate, unknown, disputed, and suggested truth states;
- family contributions and alternate recollections;
- related Living Memories;
- Chapter membership;
- provenance and operation receipts;
- privacy/access scope;
- revision and contribution history;
- resurfacing history;
- derivative artifacts such as translations, descriptions, Reels, or Life Stories.

## Authority hierarchy

1. Original source media and testimony.
2. Attributed human corrections and contributions.
3. Structured extraction from sources.
4. Generated summaries, descriptions, translations, narratives, and presentations.

Generated artifacts never silently replace a higher-authority source.

## Living behavior

A Living Memory may become richer over time through additional voices, photographs, corrections, context, relationships, and related memories. Enrichment is additive and attributable.

## Privacy and sharing

The canonical Living Memory begins private. External sharing creates a bounded **Share Artifact** rather than exposing the entire private object. The creator previews and deliberately selects what crosses the archive boundary.

## Implementation mapping

The existing `MemoryStory` record, `MediaAsset`, transcript revisions, truth facts, generated artifacts, operation receipts, and durability contracts remain valid implementation infrastructure.

For the current migration stage:

- `MemoryStoryId` remains the persistence identifier;
- `LivingMemoryId` is a compatibility alias to the same identifier;
- `LivingMemory` is the aggregate assembled over the existing record and source-grounding structures;
- database/table renaming is not required merely to achieve customer-vocabulary purity;
- future migrations must be justified by product or operational value, not naming aesthetics.

## Completion definition

A Living Memory can be considered complete only when required original source media is durably preserved, ownership is established, and the completion path can truthfully represent the memory as part of the Family Archive.

The first completed Living Memory for a person/account emits the canonical activation event `first_living_memory_completed`.
