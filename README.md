# Memories: My Story

**Foundation package:** Version 1.1  
**Fresh-start repository package:** Version 1.1  

**Canonical repository:** `https://github.com/sanlorenzoprx/memoriesmystory`
**Local repository:** `C:\repos\memoriesmystory`  
**Technical application name:** `memoriesmystory`

This folder is the organized starting point for the Memories: My Story application.

Memories: My Story exists to preserve a person through the memories they tell, the photographs that awaken those memories, and the sound of their real voice.

Start with [AGENTS.md](AGENTS.md), which routes each task to the exact governing documents and folders. Then follow [docs/00_START_HERE.md](docs/00_START_HERE.md) for document authority. Do not begin feature or architecture work without reading the applicable Foundation documents.

## Current state

- Packet 0 bootstrap branch: React Router v8 + React + TypeScript + Vite application shell with Cloudflare Worker assets serving.
- Founding Principles: completed and locked as Version 1.0.
- Product Invariants: completed and locked as Version 1.0.
- Product Vision: consolidated and completed as Version 1.0.
- User Experience, including the first five minutes: approved as the binding first implementation contract in Version 1.1.
- Product language, Muse behavior, decision framework, and build order: organized as implementation guides.
- Application stack: React Router v8, React, TypeScript, and Vite on Cloudflare Workers.
- Phase 1 solo Memory Story build specification: included under `docs/IMPLEMENTATION/`.
- Repository task routing: root and folder-level `AGENTS.md` guides are active.
- Durable learning memory: observations and controlled change proposals live under `docs/LEARNING/`.

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
