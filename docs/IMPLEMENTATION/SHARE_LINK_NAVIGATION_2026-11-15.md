# Family Share Link Navigation — 2026-11-15

**Result:** PARTIAL — routing repaired and browser-proven locally; clean-install CI, a created-share recipient journey and deployed proof pending.
**Base:** `main` `d0a550b0a9cd7b6920f3cdfb8d1f5307917d75da`
**Branch:** `claude/wonderful-einstein-lhk453`
**Source finding:** F1 in `REPO_AND_HANDOFF_REVIEW_2026-11-15.md`

## Outcome

A person who opens a family share link in a browser now reaches the Worker's share page. Before this change the browser received the app shell and showed the app error screen, because single-page-application asset handling answers navigation requests before the Worker runs (documented Cloudflare behaviour for compatibility dates from 2025-04-01).

**Promise protected:** creator-controlled, bounded family sharing (Living Memory Share Policy V2). A share the owner deliberately created must be openable by its recipient, and a revoked or unknown link must show the Worker's refusal page.

## Change

- `wrangler.jsonc`: `assets.run_worker_first` lists `/shared/*`, `/resources/*`, `/api/*`, `/mcp`, `/health`, `/robots.txt`, `/sitemap.xml`. `scripts/deploy-staging.mjs` derives its configuration from this file, so staging inherits it.
- `tests/e2e/worker-navigation.spec.ts`: three real-navigation checks with no route stubs.
- No Worker code, migration, copy, Foundation document or product behaviour changed.

## Evidence

| Check | Result |
| --- | --- |
| New navigation suite without the fix | 2 of 3 fail (share page and direct media/resource addresses return the app shell) |
| New navigation suite with the fix | 3 of 3 pass |
| `npm run verify:core` | Pass — typecheck, lint, 238 tests, 88 schema objects, build, deploy dry run |
| `playwright test` (phone viewport) | 49 pass; 9 not run |
| Staging / deployed Worker | NOT_RUN |
| Real device | NOT_RUN |
| Human | NOT_RUN |

The nine checks not run are all in `tests/e2e/legacy-recording.spec.ts`. That file launches its own browser build, which is not installed in the review sandbox (`Executable doesn't exist`). They passed in main CI run 43692868082 and are unaffected by this change. Clean-install CI on this branch is the authority for the full 58.

## Anti-drift

Private by default, originals immutable, human and Muse material distinct, no share reward: unchanged. The share page's content, selection enforcement, token handling and revocation are untouched; only which layer answers the request changed.

## Known limits

- The local Worker has no `SHARE_TOKEN_PEPPER`, so the suite proves routing and the unavailable-link page, not the content of a created share. A recipient journey (create, open, revoke, 404) against real D1/R2 with a test secret is still required for A01 acceptance.
- Any new Worker route prefix must be added to `run_worker_first`; otherwise direct navigations to it return the app shell.
- `npm audit fix` was attempted for finding F7 and failed inside npm itself (`Cannot read properties of null (reading 'edgesOut')`); no dependency was changed.

**Reversible:** yes. **Production deployed:** no.
