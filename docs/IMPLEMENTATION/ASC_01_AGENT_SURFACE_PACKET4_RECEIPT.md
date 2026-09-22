# ASC-01 Agent Discovery & Engagement Surface — Packet 4 Receipt

**Date:** 2026-08-27  
**Branch:** `feat/asc-01-agent-surface-packet4`  
**Base:** `packet-4/account-binding-recovery`  
**Production deployment:** NOT AUTHORIZED / NOT PERFORMED

## Outcome

ASC-01 is implemented as a public acquisition and guidance boundary around the existing Memories: My Story application.

The implemented primitive is the deterministic **Legacy Story Starter**. REST and MCP adapters reuse the same prompt capability. The public agent surface has no call path into authenticated archive or media handlers.

## Product invariants protected

- **I-01 — original voice is primary:** ASC prompts end in a human start URL; they do not generate or replace testimony.
- **I-03 — never editorially correct a memory:** the public surface does not rewrite any existing memory.
- **I-04 — storyteller controls truth state:** prompts ask rather than assert family facts.
- **I-11 — technology stays in the background:** public output uses ordinary family-story language rather than model/runtime language.
- **I-12 — Muse listens before asking:** prompt language is warm, bounded, uncertainty-friendly, and intended one question at a time.
- **I-16 — family controls visibility:** ASC cannot access or change archive visibility.
- **I-18 — generated content is distinguishable:** Story Starter output is explicitly guidance, not testimony.

## Implemented files

### Product/domain capability

- `app/domain/agent-surface.ts`
- `app/services/agent/prompt-library.ts`
- `app/services/agent/story-starter.ts`
- `app/services/agent/interview-plan.ts`
- `app/services/agent/photo-story-prompts.ts`

### Public runtime boundary

- `worker/agent-routes.ts`
- `worker/discovery-routes.ts`
- `worker/index.ts`

Public REST:

- `GET /api/v1/product`
- `POST /api/v1/legacy-story-starter`
- `POST /api/v1/interview-plan`
- `POST /api/v1/photo-story-prompts`

Public MCP, revision `2026-07-28`:

- `memories.explain_living_memory`
- `memories.create_story_starter`
- `memories.create_interview_plan`
- `memories.create_photo_story_prompts`
- `memories.create_family_story_questions`
- `memories.start_living_memory`

### Discovery

- `public/llms.txt`
- `public/llms-full.txt`
- `public/openapi.json`
- `public/agent/index.md`
- `public/agent/capabilities.md`
- `public/agent/privacy.md`
- `public/agent/evidence.md`
- `public/agent/examples.md`
- runtime-generated `/robots.txt`
- runtime-generated `/sitemap.xml`

The sitemap is generated from the active request origin because repository operations policy states that production is a future public service and deployment remains closed pending separate owner approval.

## Privacy boundary

ASC-01 does not read or list:

- photographs;
- original voice recordings;
- transcripts;
- private Memory Stories;
- family graph or family members;
- identity or ownership records;
- provenance records;
- archive IDs;
- private share tokens.

ASC instrumentation logs only tool name, generated starter ID, coarse agent client/protocol, channel, product, and success. It does not log request bodies or family-story content.

## Cost/architecture

- no new D1 table;
- no new R2 use;
- no Queue requirement;
- no AI/provider requirement;
- no Durable Object;
- no Workflow;
- no Vectorize;
- no second Worker or framework layer.

## Verification added

- `tests/unit/agent-story-starter.test.ts`
- `tests/integration/agent-surface.test.ts`

They cover deterministic prompt limits, English/Spanish behavior, non-invention of supplied family facts, shared interview capability, no photo-context echo as testimony, public product boundary, MCP tool allowlist/header matching, and host-neutral robots/sitemap generation.

CI execution status is recorded on the pull request; this receipt does not claim green verification before those checks run.

## Deferred by explicit ASC direction

- recommendation/discoverability model benchmark suite;
- recurring 200-query evaluation;
- agent-ranking CI gates;
- acquisition/revenue proof thresholds;
- private authenticated archive access for external agents;
- public global feed;
- A2A/WebMCP dependency;
- separate ASC platform or database.

## Next action

Review and land this slice onto the active Packet 4 line only after its existing repository checks are green. Production remains unchanged.
