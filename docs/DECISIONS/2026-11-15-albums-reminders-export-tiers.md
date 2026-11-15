# Albums, reminders by email or push, and export tiers

**Status:** proposed. Owner direction received 2026-11-15; the open questions below must be answered before implementation of each part.

## Context

On 2026-11-15 the owner gave three directions while the expanded first release was being built:

1. Reminders should reach people by **email or push**, not only inside the app, as a growth component.
2. The archive page should offer **export options**: an **album export as a premium feature** and a **plain file export for the basic plan**.
3. Legacy images should be organized as **albums** that the primary owner, **or anyone they give permission to**, can create — for example family holidays, a vacation, or an album for a specific person — with some **basic starter albums**. The owner asked what is already built and for research into a best-in-class model.

## What already exists (main `25e3dd5`)

| Asked for | Already built | Not built |
| --- | --- | --- |
| Albums the owner creates | **Chapters** (PR #40): create, name, describe, order, choose a cover, put one memory in several without copying it, remove without losing memories | The word "album" in the interface; starter suggestions |
| An album for a specific person | Named people linked to memories (PR #42); search by a person's name (PR #48) | A person view that gathers that person's memories as an album |
| Sharing an album with family | Invitations scoped to one Chapter or a whole archive, viewer or contributor (PR #43) | — |
| Family adding to an album's memories | Written, voice and photograph recollections with owner review (PRs #44–#47) | Family adding new photographs as new album items |
| Permitted family creating albums | — | Not built: only the owner can create or edit a Chapter |
| Plain file export | ZIP of verified originals, manifest and readable index (PR #50) | Shared conversation recordings in the export |
| Album export | — | Not built |
| Reminders | — | Not built |

## Research: how others model family albums (checked 2026-11-15)

- **Google Photos shared albums:** anyone with the link can view; signed-in people can add if the owner allows it; originals kept only in "Original quality"; face grouping is on by default.
- **iCloud Shared Albums:** owner and subscribers; a per-album setting lets subscribers add; shared copies are reduced to 2048 px and 720p; limits of 5,000 items, 200 albums and 100 subscribers.
- **FamilySearch Memories:** photographs, stories, documents and audio; people are tagged by a person and each tagged person gets an album of their memories; albums are also made by hand; a family feed shows relatives' additions.
- **StoryWorth / Remento:** prompt-led stories by email, voice or video, sold largely through a printed book.

What this suggests for Memories: My Story, within its own rules:

1. **Two kinds of album.** Hand-made albums (what Chapters are) and **person albums that assemble themselves** from the people a human has named — never from face recognition, which the product forbids and which is the main privacy complaint about the mainstream products.
2. **A per-album "family can add" setting** is the common pattern, rather than a global role.
3. **Originals stay originals.** Reduced copies in shared albums are the main quality complaint elsewhere; this product already keeps and verifies originals.
4. **The album as a keepsake** (a designed page or book) is where the storytelling products charge, which fits the owner's premium/basic split.

## Proposed decisions

### A. Albums

- Keep **Chapter** as the stored object and the Foundation term in the Moment → Chapter → Life → Family ladder. *Open question 1 asks whether the interface should say "Album".*
- Add **starter suggestions** when creating one: Family holidays, Vacations, A person, A home, A tradition. They are suggestions for a name only; nothing is created until the person chooses.
- Add **person albums**: opening a named person shows the memories a human linked to them. No face or voice recognition, no inferred identity.
- Let the owner grant **album-making permission** to an invited relative. *Open question 2 sets its limits.*

### B. Reminders by email or push

- Build opt-in reminders with a visible cadence and a one-step unsubscribe that is verified by test, as the handoff requires.
- Introducing an email or push provider adds a new processor of personal data, which the stop rules reserve for the owner. *Open questions 3 and 4.*
- Guardrails that do not change: no reward for sharing; no message that manufactures urgency or uses grief; nothing about a relative's private memory in a message to someone not invited to it; no real family content in logs.

### C. Export tiers

- **Plain file export stays available to every owner.** The Foundation's portability promise ("take their memories with them") should not sit behind payment.
- **Album export is a premium keepsake**: a designed, readable album of one Chapter (cover, photographs, the storyteller's words, attributed family recollections, voice as playable files beside it). It is a derivative with a source manifest and owner review, which is also what packet G01 requires.
- Charging depends on packets H01–H03 (prices, terms, sandbox checkout), which are not built. *Open question 5.*

## Open questions for the owner

1. **Naming.** Should the interface say "Albums" instead of "Chapters"? "Chapter" is defined in the locked Product Language and Product Vision, so changing the customer word needs your explicit approval; the stored model would not change.
2. **Album-making permission.** When you let a relative make albums, may they (a) only arrange memories they were already invited to see, or (b) also add new photographs as new memories in your archive? May they edit or remove albums other people made, or only their own?
3. **Reminder channel and provider.** Email, push, or both? Which provider (for example Cloudflare Email, Resend, Postmark)? A provider account and credentials are needed.
4. **Who gets messages.** Only the account owner about their own archive, or also invited family (for example "a new recollection was included for you")? May an invitation itself be sent by email rather than as a copied link?
5. **Premium boundary.** Is album export the only premium export, and may it be built now behind a switch that stays off until prices and terms exist?

## Alternatives considered

- **In-app-only reminders.** Least commitment, no provider; rejected by the owner as too weak for growth.
- **A new "organizer" role** instead of a per-album setting. Simpler to explain, but coarser than the common per-album pattern and it would require rebuilding an immutable grants table.
- **Paywalling all export.** Conflicts with the portability promise.
- **Face-grouped person albums.** Conflicts with the rule against identity inference.

## Affected Product Invariants

Private by default; creator-controlled sharing; sharing never rewarded; originals immutable; human testimony distinct from generated material; no identity inference; portability. The customer word "Chapter" is locked language (open question 1).

## Evidence required

For each part when built: authorization tests for the new permission, opt-in and verified opt-out tests for reminders, a source manifest and owner review for album export, English and Spanish, and the usual receipts. Hosted, device and human acceptance remain separate gates.

## Consequences and follow-up

Nothing in this record is implemented. Work that does not depend on these answers continues: adding shared conversation recordings to the plain export, then starter suggestions and person albums, which follow existing rules.
