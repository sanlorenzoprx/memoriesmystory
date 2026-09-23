# Next Phase — Archival Photo Capture + Our Living Legacy

**Status:** queued after Week-One human proof
**Rule:** do not begin feature implementation until the solo Living Memory proof clears the human gate.

## Why this order

Build the **physical-photo digitization path first**, then the multi-person video experience.

That is the higher-leverage sequence:

1. every solo and group memory benefits from a better source photograph;
2. it improves the permanent artifact without changing the storytelling model;
3. it is materially smaller and safer than building real-time video;
4. the finished digital original becomes the photograph pinned inside **Our Living Legacy**.

Do not build a miniature Zoom product before the source-preservation layer is excellent.

---

# Phase 2A — Physical Photograph → Archival Digital Original

## Product promise

A person can place an old physical photograph in front of the phone, receive simple guidance, capture the best practical digital copy, and preserve **both** the untouched camera capture and a derived corrected scan.

The corrected image never replaces the source capture.

## First capture experience

The guidance should feel like a calm scanner, not photography software:

- place the photograph on a flat, neutral surface;
- fill most of the frame without cutting off edges;
- keep the phone parallel to the print;
- use soft, even light;
- detect glare, deep shadow, blur, and clipped edges;
- ask the person to move closer / tilt slightly / steady the phone only when needed;
- allow **Use this photo anyway** at every quality-warning step.
## Best-result capture stack

Prefer the highest-quality still capture available from the device.

Order of preference:

1. browser/device still-photo API at native camera resolution;
2. `ImageCapture.takePhoto()` when supported;
3. high-resolution video frame capture as fallback;
4. ordinary file import remains available at all times.

Do not treat a low-resolution video preview screenshot as the archival master when a real still capture is available.

### Practical quality target

For common 4×6 and 5×7 prints, aim for at least roughly **300 pixels per inch equivalent** across the original print and preserve more when the camera provides it.

A simple product-level proxy is more useful than asking users to understand DPI:

- photograph fills roughly 80–90% of the usable frame;
- shortest captured edge should preferably be at least about 1800–2100 pixels for common snapshots;
- preserve the full native capture when available.

Higher resolution is useful, but sharp focus, low glare, and keeping all print edges are more important than chasing a nominal megapixel number.

## Quality checks

Run lightweight, preferably on-device checks for:

- four edges / corners visible;
- perspective skew;
- blur / detail loss;
- glare / blown highlights;
- deep shadow;
- underfilled frame;
- severe rotation;
- minimum usable resolution.

Quality checks guide; they do not judge the memory or block preservation.
## Derived archival correction

After acceptance, create a separate derived scan:

- detect the four photo corners;
- perspective-correct / deskew;
- crop to the print boundary;
- rotate to natural orientation;
- apply restrained exposure / white-balance correction if useful;
- never perform generative reconstruction as part of the archival original;
- never erase writing, damage, borders, dates, or physical marks from the source.

Keep explicit provenance:

**physical print → original camera capture → corrected archival derivative**

If enhancement is later offered, it must become another derivative, never the original.

## Strong additions after the first capture works

- optional **photograph the back** for handwritten names, dates, stamps, or notes;
- front/back pairing as one source object;
- glare-reduction second shot when glare is detected;
- batch scanning only after single-photo capture is excellent.

Do not start with automatic restoration, face repair, colorization, or generative cleanup. Those are attractive but premature and create authenticity risk.

## Phase 2A exit

A normal user can digitize one physical photograph with visibly better geometry and readability than a casual snapshot while the untouched source capture remains preserved.
---

# Phase 2B — “Our Living Legacy”

## Product idea

**Our Living Legacy** is a shared family conversation around one photograph.

The photograph is the anchor. The people are visible around it. Each person can remember the same moment differently.

The product preserves those perspectives; it does not reconcile them into one official truth.

## Core experience

1. Host chooses an existing Living Memory photograph or newly digitized print.
2. Host starts **Our Living Legacy**.
3. Family/friends join through a private invitation.
4. The photograph remains pinned and large enough to inspect throughout the conversation.
5. Participant video tiles remain visible around/beside the photograph.
6. The group talks naturally about what the image brings back.
7. Each person's contribution remains attributed to that person.
8. Muse may optionally ask a remembering question, but never arbitrate disagreement.
9. Participants review their own attribution/context where needed.
10. Session is preserved as a group Living Legacy attached to the photograph.
## Storyteller sovereignty in a group

This is the governing rule:

**Different recollections are part of the memory, not errors for the software to resolve.**

If Maria says it was 1968 and Luis remembers 1969:

- preserve Maria's recollection as Maria's;
- preserve Luis's recollection as Luis's;
- allow either person to say approximate / unknown;
- do not display a system verdict;
- do not merge the two into a synthetic date.

Muse can ask:

> “What do you remember happening just before this photograph?”

Muse must not ask:

> “Which of you is correct about the year?”

## Preservation model

Preserve:

- pinned source photograph;
- original group-session media;
- participant identity / display attribution;
- speaker-attributed transcript as a derivative;
- participant-specific context;
- Muse prompts and provenance separately;
- session start/end and contribution ordering.

For stronger future editing and preservation, prefer separate participant audio tracks when the selected real-time provider supports them. A composite recording alone is convenient but is a weak archival master.
## Architecture boundary

Do **not** build real-time media transport from scratch.

Use a replaceable real-time provider behind a small session adapter. The product owns:

- Living Legacy session contract;
- participant permissions;
- photograph anchoring;
- attribution;
- preservation;
- privacy;
- Muse behavior;
- completion artifact.

The provider owns commodity transport such as WebRTC routing, reconnection, bandwidth adaptation, and media delivery.

Provider selection is a separate evidence task; do not parameterize every possible video platform in advance.

## Privacy defaults

- invitation-only by default;
- no public room discovery;
- clear recording consent before capture starts;
- visible recording state;
- participant removal / leave semantics;
- host cannot silently rewrite another participant's contribution;
- sharing is downstream of a completed Living Legacy and uses the same bounded-artifact principle as solo Living Memories.

## Smallest useful Phase 2B proof

Prove only:

**one photograph + host + one remote family member + live conversation + original session recording + speaker attribution + replay**

Then expand to 3–6 people.

Do not begin with breakout rooms, reactions, virtual backgrounds, scheduling systems, public events, or Zoom-style meeting administration.

## Phase 2B exit

Two uncoached people can join around one photograph, talk naturally, end the session, reopen it, see the photograph, hear the preserved conversation, and understand whose recollection is whose.
---

# Sequencing after Week One

1. Complete Week-One three-person human proof.
2. Lock the solo Living Memory release-candidate SHA.
3. Run a short research/prototype spike for high-quality still capture on target phones.
4. Build Phase 2A single-photo archival capture.
5. Human-test physical → digital quality and ease.
6. Freeze the digitized-photo source contract.
7. Select the real-time provider using a two-person prototype.
8. Build the smallest **Our Living Legacy** session.
9. Preserve separate perspectives and original media.
10. Human-test two-person then small-family sessions.

The key discipline remains unchanged:

**the original human artifact is primary; AI and transformations are derivatives.**
