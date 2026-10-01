# Functional Discovery Surface 01 — Implementation Receipt

**Branch:** `feat/functional-discovery-surface-01`  
**Base:** integrated `main` containing Packet 0-4 and ASC-01  
**Status:** implementation complete pending CI/merge/authorized deployment.

## User outcome

Create multiple useful public doors into one privacy-bounded function:

`search / AI / social / partner / directory intent -> Legacy Story Starter -> human start link -> ordinary Living Memory experience`

Generated guidance never becomes human testimony and the public discovery layer never gains access to a private archive.

## Product invariants protected

- authentic human voice remains primary;
- generated prompts remain guidance rather than memory;
- originals/private stories remain outside the public surface;
- sharing, identity binding, media upload and private-story creation require ordinary human product actions.

## Executed slices

### FD-01 — Intent catalog

Ten high-intent family-story doors are defined in `config/functional-discovery-intents.json`: mother, father, grandmother, grandfather, aging parents, oral history, preserving a parent's voice, old photographs, family recipe stories, and family reunion questions.

### FD-02 — Functional static utilities

`scripts/generate-functional-discovery-pages.mjs` runs during build and emits crawlable HTML plus a Markdown twin for all ten intents.

Each page calls only the existing deterministic `POST /api/v1/legacy-story-starter` capability and returns its same-origin human start URL.

### FD-03 — Privacy-bounded inputs

The utility asks only for language and available time; relationship category and prompt themes are curated in the intent catalog. It does not request family names, archive IDs, photographs, voice, transcripts, provenance records, or share tokens.

### FD-04 — Search and AI discovery

The host-neutral Worker sitemap includes all utilities. `robots.txt` explicitly allows general crawlers, OAI-SearchBot, and ChatGPT-User. `llms.txt` and `llms-full.txt` index the public capabilities and utilities.

### FD-05 — Multi-channel distribution

`/discovery-manifest.json` provides Story Studio path templates. `/distribution-channels.json` adds partner, directory, newsletter, community, social and Story Studio acquisition suffixes without creating channel-specific copies of the pages.

### FD-06 — IndexNow

A public verification key is present. `npm run indexnow:submit` requires `MEMORIES_PUBLIC_ORIGIN` and refuses to run until an authorized HTTPS public origin exists.

### FD-07 — MCP Registry packaging

`npm run mcp-registry:generate` creates `server.json` from the authorized `MEMORIES_PUBLIC_ORIGIN`; no domain is invented in source control. The generated metadata describes the public `/mcp` remote using Streamable HTTP.

### FD-08 — Verification

`tests/unit/functional-discovery.test.ts` checks the ten-intent catalog, Legacy Story Starter reuse, privacy boundary, crawler surface, multi-channel distribution, and host-gated MCP Registry generation.

## Deliberately not added

- no private archive MCP/search;
- no generated family biography;
- no autonomous Memory Story creation;
- no public family feed;
- no 200-page content factory;
- no new AI provider, D1 table, R2 bucket, Durable Object, Workflow, or vector store;
- no recommendation/ranking proof harness before live traffic exists.

## Release completion

1. Full PR CI green including typecheck, lint, unit/integration tests, build, Cloudflare dry run and phone-first E2E.
2. Merge to `main`.
3. Deploy only through an authorized Memories environment.
4. Set `MEMORIES_PUBLIC_ORIGIN` to that origin and run IndexNow submission.
5. Generate/publish MCP Registry metadata only after `/mcp` is publicly reachable.
6. Point Story Studio and external distribution at specific utility paths from the discovery manifest rather than the homepage.
