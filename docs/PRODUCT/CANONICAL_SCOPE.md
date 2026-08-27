# Canonical Product Scope

Use this page to prevent implementation ideas from redefining the product.

## Product

**Memories: My Story** is a global, mobile-first, software-first, AI-assisted, Cloudflare-first web application for turning photographs and authentic human recollections into **Living Memories** and connecting them into a durable family archive.

The product is a **private-first Living Memory Archive**. It is not a mail-in digitization business, generic cloud-storage service, social network, genealogy database, generic journal, AI biography generator, or Android-only application.

AI is important infrastructure and product capability, but it remains subordinate to the human source. Muse helps people remember, organize, retrieve, connect, translate, and present source-grounded memories; it never becomes the storyteller.

## Core product paths

1. **Capture Your Memories — Solo:** one person captures or chooses a photograph, tells what they remember in their real voice, optionally receives one useful Muse prompt, preserves source media and context, experiences the Living Memory playback, and chooses whether to invite or share.
2. **Preserve Together — In Person:** family or friends remember around one photograph in person; the application records the natural conversation, preserves attribution and disagreement, and enriches the Living Memory.
3. **Remember Together — At a Distance:** family or friends join a Memory Circle remotely; the photograph remains the main visual while participants see one another, remember, contribute, review, preserve, and receive access according to archive permissions.
4. **Rediscover:** people later find and revisit Living Memories through people, places, dates, relationships, Chapters, related memories, and respectful resurfacing.

## First product proof

The first product proof is one complete Living Memory:

**Photo → Voice → Muse → Preserved → Playback → Invite/Share**

The canonical activation event is `first_living_memory_completed`.

## Launch rules that do not drift

- A new Living Memory is private by default.
- The first free Living Memory is available without requiring a share.
- Sharing never unlocks another free Living Memory.
- Each current free Living Memory voice allowance is centrally configured; it is 30 seconds in the present Phase 1 configuration and may change through a product decision without changing the Living Memory doctrine.
- Sharing may be family-directed, direct, social, or public only by deliberate creator choice.
- External sharing uses a bounded Share Artifact and never exports private archive metadata by default.
- Facebook is the first public social target; WhatsApp is the next family-to-family target. Platform sequencing may evolve from evidence.
- Muse behaves as a warm memory companion and stays unobtrusive unless useful.
- Original voice and photograph remain primary, immutable sources.
- Generated content remains derivative, attributable, and source-grounded.
- The completion sentence remains exactly: **“This memory is now part of your family's history.”** until explicit product testing changes it.
- The application is globally localizable from the beginning, with strong English and Spanish experiences first.
- Offline recovery, cross-device continuation, exportability, and future legacy stewardship are core obligations.

## Long-term value ladder

**Moment → Chapter → Life → Family**

A Living Memory captures a Moment. Related Living Memories can form a Chapter. Chapters can reveal a Life. Lives and relationships connect into a Family Archive.

## Repository rule

`sanlorenzoprx/memoriesmystory` is the only canonical application repository. Product truth comes from the Foundation documents and approved decisions. Code truth comes from the current implementation and receipts in this repository. Existing `MemoryStory` names are compatibility implementation details beneath the Living Memory aggregate until a migration produces real product or operational value.
