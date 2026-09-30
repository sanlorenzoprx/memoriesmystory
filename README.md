# Memories: My Story

**Foundation package:** Version 1.1  
**Fresh-start repository package:** Version 1.1  

**Canonical repository:** `https://github.com/sanlorenzoprx/memoriesmystory`
**Technical application name:** `memoriesmystory`

This folder is the organized starting point for the Memories: My Story application.

Memories: My Story exists to preserve a person through the memories they tell, the photographs that awaken those memories, and the sound of their real voice.

Start with [AGENTS.md](AGENTS.md), which routes each task to the exact governing documents and folders. Then follow [docs/00_START_HERE.md](docs/00_START_HERE.md) for document authority. Do not begin feature or architecture work without reading the applicable Foundation documents.

## Current state

See [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md). In short: the solo Living Memory loop (photo → voice → Muse → preserve → playback → optional family share) works end to end in isolated Cloudflare staging; the release candidate still needs real-phone and uncoached human acceptance. Nothing is deployed to production.

## Fresh-start rule

This repository begins from the approved Foundation and Phase 1 specification in this package. No application code, architecture, migration, provider, or business rule is inherited from another codebase. New implementation must be written and verified against the Foundation documents.

All technical identifiers use `memoriesmystory`. The customer-facing brand remains **Memories: My Story**.

## Developer start

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

The Cloudflare Worker entry is `worker/index.ts`; the browser app is served from the Vite build output through Wrangler assets.

## Canonical mission statement

**Memories: My Story exists to preserve a person through the memories they tell, the photographs that awaken those memories, and the sound of their real voice.**

## North Star

**Will this help preserve someone's story for future generations?**

## Company reminder

We are building software.

But more importantly, we are preserving families.
