# Memories: My Story — Public Agent Capabilities

## REST

### GET `/api/v1/product`
Returns product identity, the Living Memory concept, public capability paths, the Muse boundary, and `private_archive_access: false`.

### POST `/api/v1/legacy-story-starter`
Returns a deterministic set of warm story prompts, photo prompts, follow-up prompts, a capture tip, and a human start URL. No account or archive lookup is required.

### POST `/api/v1/interview-plan`
Reuses the same Story Starter capability and arranges prompts into a gentle interview sequence. It is guidance, not a questionnaire the storyteller must complete.

### POST `/api/v1/photo-story-prompts`
Accepts only general caller-supplied context such as “old family wedding photograph.” It does not accept or inspect private photograph bytes.

## MCP

Protocol revision: `2026-07-28`.

Tools:

- `memories.explain_living_memory`
- `memories.create_story_starter`
- `memories.create_interview_plan`
- `memories.create_photo_story_prompts`
- `memories.create_family_story_questions`
- `memories.start_living_memory`

`memories.start_living_memory` returns a same-origin URL with `requires_user_action: true`. It never creates, uploads, publishes, shares, or mutates a private Memory Story.

## Shared capability rule

REST and MCP reuse the same deterministic prompt library. There is no separate agent-specific storytelling engine and no model dependency in ASC-01.
