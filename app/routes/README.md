# Routes

Read `../AGENTS.md` and the root `AGENTS.md` before changing a route.

Place route modules, loaders, actions, error boundaries, and accessible route-level states here. The initial route set serves the first five-minute experience before wider navigation is added.

## Route review checklist

1. Identify the exact stage of the approved first-five-minute arc.
2. Read the route responsibility in `docs/IMPLEMENTATION/PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md`.
3. Inspect the loader, action, domain state, failure recovery, and relevant tests together.
4. Keep durable business rules in `domain/` and vendor boundaries in `services/` or the Worker.
5. Verify mobile, keyboard, assistive-technology, interrupted-network, and truthful-state behavior where applicable.

## Phase 1 route map

| Route | User outcome | Required review focus |
| --- | --- | --- |
| `/` | Understand why preserving a photograph and real voice matters; choose capture or import. | No permission wall, AI language, feature tour, or false save claim. |
| `/capture/:draftId` | Complete the recoverable photograph and voice path. | Contextual permissions, local recovery, photograph dominance, recording playback. |
| `/stories/:storyId` | Review and return to a completed Memory Story. | Human/generated distinction, original playback, additive edits, truthful status. |
| `/share/:token` | Receive a deliberately shared Memory Story. | Explicit visibility, least disclosure, safe expired/revoked state. |
| `/resources/*` | Perform one narrow mutation or status read. | Validation, authorization, idempotency, durable receipts, recoverable failure. |

Exact route filenames may evolve with the selected React Router convention. The responsibilities and Foundation constraints do not.
