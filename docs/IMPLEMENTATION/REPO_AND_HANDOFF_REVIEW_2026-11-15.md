# Repository and V2 Handoff Review — 2026-11-15

**Type:** review receipt (evidence and recommendations only).
**Reviewed code:** `main` at `d0a550b0a9cd7b6920f3cdfb8d1f5307917d75da` (merge of PR #44).
**Reviewed document:** *Memories: My Story V2 — Autonomous Engineering Handoff*, Version 2.1.
**Changes made by this review:** this file only. No application code, configuration, migration, Foundation document, queue or status page was changed. Nothing was deployed.

## 1. Verdict

The codebase is in good condition. Everything that can be checked automatically passes, and the newest family-access and contribution code holds up to a close security read: authorization is re-checked inside the write transaction, originals and revisions are immutable at the database level, and replay/idempotency is handled consistently.

Three things need attention:

1. **Family share links do not open in a browser.** A person who taps a `/shared/…` link sees the app's "Something went wrong" screen instead of the shared memory. This is a one-line configuration fix (section 3, F1). It has been missed because no test opens a share link the way a recipient does.
2. **The handoff is two merges behind the repository.** It describes E03 as uncommitted local work and E04 as not started. Both are merged (PRs #43 and #44). Section 4 lists every statement to correct.
3. **Release hardening (packet A07) is still genuinely open**: no baseline security headers on the app shell, no request-rate limiting, and two contributor-rights questions that need an owner decision (F2, F3, F5).

## 2. What was verified

Run on a clean `npm ci` of `d0a550b`.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` | Pass — 238 tests in 55 files |
| `npm run test:schema` | Pass — 88 required objects, integrity, foreign keys, immutable originals |
| `npm run build` | Pass (chunk-size warning, see F8) |
| `npm run test:e2e` (phone viewport) | 46 passed; 9 could not run in this sandbox |
| GitHub CI on `main` `d0a550b` | [Run 43692868082](https://github.com/sanlorenzoprx/memoriesmystory/actions/runs/43692868082) — success |
| Open pull requests | Only parked PR #13 |

The 9 browser tests that did not run are all in `tests/e2e/legacy-recording.spec.ts`. That file launches its own browser build, which is not installed in the review sandbox; the failure is `Executable doesn't exist`, not an assertion. They passed in the CI run above.

Not verified here: any deployed environment, hosted Clerk sign-in, real ElevenLabs/Workers AI/RealtimeKit calls, physical devices, or human acceptance.

Code read in full: `worker/index.ts`, `auth-session.ts`, `request-body.ts`, `family-permissions.ts`, `family-access-routes.ts`, `family-contributions.ts`, migrations 0016–0017, `wrangler.jsonc`, CI workflow, Playwright config. Read in part: `sharing.ts` (public page, media, tokens), `deletion.ts`, `auth-routes.ts`, range handling in all six media handlers, CSRF guards in every route file.

## 3. Code findings

Ordered by severity. "Confirmed" means reproduced; "By inspection" means read from the code.

### F1 — High — Family share links show an error page in a browser (confirmed)

**What happens.** `wrangler.jsonc` serves the app with `not_found_handling: "single-page-application"` and a 2026 compatibility date. Under that combination Cloudflare answers every browser *navigation* with `index.html` and does not run the Worker. The share page lives in the Worker at `/shared/:token`, and the app has no `/shared` route, so the recipient gets the app's error boundary.

**Evidence.**

- Local `wrangler dev`, same URL: a plain request reaches the Worker; the same request with `Sec-Fetch-Mode: navigate` returns `200 text/html` (the app shell).
- A phone-emulated Chromium opening `/shared/<token>` rendered: "The story is not lost. Something went wrong. Return home", with no share-page Content-Security-Policy.
- Cloudflare documents this as intended behaviour for compatibility dates from 2025-04-01: [Single Page Application routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/).
- No e2e test navigates to `/shared/`; the integration test calls the handler directly, so it cannot see this.

Images and audio inside the share page are not navigations and are unaffected. The same bypass applies to anyone opening `/health`, `/robots.txt`, `/sitemap.xml` or an API URL directly in a browser.

This was reproduced on local `workerd`, not on a deployed Worker. The documented production behaviour is the same.

**Fix (tested locally, not committed).** Add explicit Worker-first routes to the `assets` block:

```jsonc
"assets": {
  "binding": "ASSETS",
  "directory": "./dist",
  "not_found_handling": "single-page-application",
  "run_worker_first": ["/shared/*", "/resources/*", "/api/*", "/mcp", "/health", "/robots.txt", "/sitemap.xml"]
}
```

With this in a temporary config, `/shared/…`, `/resources/…`, `/health` and `/robots.txt` reached the Worker for both plain and navigation requests, and app deep links (`/archive`, `/family/join/…`) still returned the app shell.

**Also add** one e2e test that creates a share, opens the link with `page.goto`, and asserts the photograph and the Worker's CSP header are present, then asserts a 404 page after revocation. That closes the "full receiving-browser verification" that packet A01's exit evidence asks for and that has not been done.

**Protects:** creator-controlled sharing (Share Policy V2) and the R0/R7 acceptance rows.

### F2 — Medium — No baseline security headers on the app shell (confirmed)

`GET /` returns only `Content-Type`, `Cache-Control` and `ETag`. Worker JSON and media responses set `nosniff` and often `Referrer-Policy`, and the share page has a strict CSP, but the application shell that handles sign-in, private media and microphone/camera access has none.

**Recommendation.** Add a `public/_headers` file (served by Workers static assets) with `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, a `Permissions-Policy` limited to `camera=(self), microphone=(self)`, and `Strict-Transport-Security`. Introduce a Content-Security-Policy in report-only mode first; Clerk and RealtimeKit both need allow-listed origins, so it should be tuned against staging before enforcing.

Also add `X-Robots-Tag: noindex` and `Referrer-Policy: no-referrer` to the public share page and its media responses in `worker/sharing.ts`. Those URLs are bearer secrets and should not be indexed or leaked in referrers.

### F3 — Medium — No request-rate limiting (by inspection)

A search of `worker/` and `config/` finds per-resource count caps (grants, chapters, people, contributions, daily recordings) but no per-client request-rate limit and no Turnstile. Share and invitation tokens are long random values, so guessing is not the risk. Cost and abuse are: the unauthenticated public agent API (`/api/v1/*`, `/mcp`), share-token and invitation-token lookups, session creation, and anonymous draft uploads to R2 can all be called without limit.

**Recommendation.** Use the Workers Rate Limiting binding on those unauthenticated routes, keyed by client IP, before any public traffic. This belongs to packets A07 and H03.

### F4 — Medium — Status documents are behind the code (confirmed)

- `docs/CURRENT_STATE.md` is dated 2026-11-14 and says of E04a "Clean-install CI remains pending". PR #44 is merged and main CI is green.
- `docs/EXECUTION/TASK_QUEUE.json` still marks E04a `implemented_local_proven_ci_pending`.
- `docs/CURRENT_STATE.md` describes E03 and E04a by their feature-branch names rather than as merged.
- `README.md` "Current state" still summarizes only the solo loop.

These are the two files the handoff names as the single ledger and single status summary, so they should be brought up to date in the next normal update.

### F5 — Medium — Two contributor-rights behaviours need an owner decision (by inspection)

Both are consistent with the code's intent but are policy choices nobody has recorded.

1. **Owner deletion removes contributors' words.** `family_contributions` is declared `ON DELETE CASCADE` on `memory_stories`. When an owner deletes a Living Memory, every relative's attributed contribution and its revision history is deleted with it, without notice to the author.
2. **Withdrawn text stays readable by the owner.** After an author withdraws, the list and history queries still return the latest revision text to the memory owner. Withdrawal removes it from the family-visible assembly only.

**Recommendation.** Add both to `docs/PRODUCT/OPEN_DECISIONS.md` alongside the existing retention/withdrawal questions, and make sure F01 export covers contributions before deletion is considered final.

### F6 — Low — Invalid byte ranges answered as `206` (confirmed)

Tested against local R2: a malformed or out-of-bounds `Range` header returns the whole object with `range = {offset: 0, length: size}`. All six media handlers then reply `206` with `Content-Range: bytes 0-(n-1)/n` instead of `416` or a plain `200`. Players cope, so this is a correctness nit. Normal, open-ended and suffix ranges all behave correctly.

The identical range block is copied in `media-routes.ts`, `sharing.ts`, `muse-voice-replies.ts`, `legacy-recordings.ts`, `legacy-remote-recording-route.ts` and `family-access-routes.ts`. Extracting one shared helper would fix this in one place and remove about 60 duplicated lines.

### F7 — Low — Dependency advisories (confirmed with `npm audit`)

| Package | Scope | Severity | Note |
| --- | --- | --- | --- |
| `react-router` 8.2.0 | production | High | GHSA-qwww-vcr4-c8h2 concerns RSC mode. The app uses `createBrowserRouter` only, so it is not exposed, but `npm audit fix` resolves it. |
| `uuid` via `@cloudflare/realtimekit` | production | Moderate | No non-breaking fix yet; track the upstream release. |
| `brace-expansion`, `nanoid`, `postcss`, `minimatch`, `@vitest/mocker` | development | Moderate–High | Build/test tooling only; `npm audit fix` resolves most. |

**Recommendation.** Run `npm audit fix`, re-run `npm run verify`, and add `npm audit --omit=dev --audit-level=high` as a CI step.

### F8 — Low — Bundle size for older phones

The main chunk is 652 kB (188 kB gzipped). RealtimeKit is already split into its own 662 kB chunk and loads on demand. The family-archive, legacy-session and identity screens are still in the main chunk. Route-level lazy loading for those would shorten first load for the capture path, which matters for the older-adult, constrained-device audience named in the acceptance gates.

### F9 — Low — No top-level error fallback in the Worker

`worker/index.ts` awaits about twenty route handlers in sequence with no outer `try/catch`. The newer handlers catch their own errors; if an older one throws unexpectedly the visitor gets Cloudflare's generic error page, unlocalized and without a stable error code. One outer catch that returns `{error:{code:"unavailable"}}` with `503` would make every failure recoverable by the existing localized error mapping.

Formatting is also inconsistent between files (several lines in `index.ts` and `deletion.ts` have no spacing). Lint passes; adding a formatter check would keep review diffs readable.

### F10 — Low — Transcription queue has no dead-letter queue

The consumer retries three times and then the message is dropped. The product recovers because transcription can be retried from the preserved original, but nothing records that a message was abandoned. A dead-letter queue would give the operations evidence that A07 asks for.

### F11 — Informational

- `SESSION_SECRET` keys both session cookies and family-invitation tokens. Rotating it signs everyone out and also invalidates every pending invitation. Either document that in the secrets guide or derive invitations from a separate secret.
- An accepted family grant has no expiry and the recipient's email is not re-verified later. Revocation is the only way access ends. That is a reasonable default; it should be stated in the share/access policy.
- `family_access_events` and `family_contribution_events` are protected against `UPDATE` but not `DELETE`. Deletion is needed for cascade, so this is acceptable, but "immutable" in the receipts should read "append-only until the parent is deleted".

### What is solid

- Authorization for contributions is re-evaluated inside the same atomic batch as the write, so a grant revoked mid-request cannot slip through.
- Private media for family members is re-checked for revocation after the storage read and before bytes are sent.
- Invitation acceptance requires a freshly fetched, verified Clerk email; a wrong account does not consume the invitation.
- Every state-changing route checks a custom request header and same-origin; cookies are `HttpOnly; Secure; SameSite=Lax`; session tokens are stored hashed.
- Request bodies are bounded by actual bytes read, not by the declared length.
- The public share page escapes all user text and ships a `default-src 'none'` policy.
- The production D1 identifier remains a non-deployable placeholder, and remote recording defaults to off.

## 4. Corrections needed in the V2.1 handoff

The handoff's requirements and guardrails (sections 0–23) are sound and match the repository's Foundation rules. Its status snapshot is out of date. A future implementer following it literally would look for an uncommitted worktree that no longer exists.

| Where in the handoff | It says | Actual state at `d0a550b` |
| --- | --- | --- |
| Header, snapshot table, §21, §22 | Verified main is `a0c4500…` (PR #42); main CI 43635780025 | Main is `d0a550b…` (PR #44); main CI [43692868082](https://github.com/sanlorenzoprx/memoriesmystory/actions/runs/43692868082), success |
| Snapshot rows "Active local branch", "E03 local verification", "E03 acceptance still missing" | E03 is uncommitted on `feat/scoped-family-invitations`; no PR exists; full 53-test run missing | E03 merged as PR #43 (`9d18404`); main CI [43689607009](https://github.com/sanlorenzoprx/memoriesmystory/actions/runs/43689607009) success; `CURRENT_STATE.md` records 226 core and 53 phone checks on the PR |
| Section "Current uncommitted E03 slice — preserve it" | Preserve the worktree, do not count it as merged | Obsolete. Replace with a short "E03 merged" entry under "What has been completed and merged" |
| Packet table, E03 row | "Uncommitted local implementation" | Merged; hosted Clerk recipient acceptance still pending |
| Packet table, E04 row; §9 E04 status | "Not implemented" / "PENDING" | **Partly merged.** PR #44 adds attributed text contributions, immutable revision lineage, author-only revise/withdraw, owner selection of a family-visible version. Voice and photo contributions and per-author transcript review remain |
| Test counts | 218 / 226 unit-integration, 51 / 53 phone | 238 unit-integration tests, 88 schema objects, 55 phone tests |
| Migrations paragraph | "0016 is introduced by the local E03 candidate" | 0016 (family access) and 0017 (contributions) are both on main and both required before a matching deployment |
| Ordered next actions, item 1 | Finish, review and merge E03 | Done. Item 1 should become: fix share-link routing (F1) and add the recipient browser test; then finish the remaining E04 sources |
| Ordered next actions, item 2 | Complete E04 | Narrow to: voice and supplementary-photo contributions, each author's transcript review, and the two policy questions in F5 |
| §21 implementation prompt; §23 recommendation | "Preserve the uncommitted E03 work…", "Finish and verify the active E03 slice" | Rewrite against `d0a550b`; there is no uncommitted work to preserve |
| §5 A01 exit evidence; D-01; R0 and R7 rows | Share management merged, "final acceptance remains" | Add an explicit known defect: recipient browser navigation fails until F1 is fixed. A01 cannot be accepted before then |
| §18 file map | Migrations `0001–0007`; Chapter domain in `app/domain/chapter.ts`; archive routes "or" a new file | Migrations `0001–0017`; domain files are `family-archive.ts`, `family-people.ts`, `family-access.ts`, `family-contribution.ts`; routes are `worker/archive-routes.ts`, `people-routes.ts`, `family-access-routes.ts`, `family-contributions.ts` |
| "Repository references" key receipts | Ends at `HUMAN_PEOPLE_REFERENCES_2026-11-14.md` | Add `SCOPED_FAMILY_INVITATIONS_2026-11-15.md` and `ATTRIBUTED_FAMILY_TEXT_2026-11-15.md` |
| Version history | Ends at 2.1 | Add a 2.2 entry when the above is applied |

Two further points about the document itself:

- **Formatting.** The file is an export with every Markdown character backslash-escaped (`\#`, `\*\*`, `\|`) and a broken first line (`[Handoff.md](http://Handoff.md)`). It renders as literal symbols rather than headings and tables. Re-export it cleanly before placing it under `docs/EXECUTION/`.
- **Authority.** The handoff correctly says it is a dated cross-reference and not a second ledger. The repository already holds `docs/IMPLEMENTATION/V2_HANDOFF_RECONCILIATION_2026-11-14.md` and `docs/EXECUTION/RESUME_CHECKPOINT_2026-11-15.md`; when the handoff is updated, link those rather than restating status in a third place.

Everything else in the handoff's status tables that could be checked against the repository was accurate: PRs #21–#42 are merged as described, PR #13 is the only open pull request, production is not deployed, and no live billing code exists.

## 5. Recommended order

1. **F1** — add `run_worker_first`, add the recipient browser test, run `npm run verify`. Small, isolated, and it unblocks A01 acceptance.
2. **F4 and section 4** — bring `CURRENT_STATE.md`, `TASK_QUEUE.json`, `README.md` and the handoff to `d0a550b`.
3. **F7** — `npm audit fix`, verify, add the audit step to CI.
4. **F5** — record the two contributor-rights questions for an owner decision before more E04 work builds on them.
5. **F2, F3, F9, F10** — fold into packet A07 (headers, rate limits, error fallback, dead-letter queue).
6. **F6, F8** — opportunistic cleanup when those files are next touched.
7. Continue the handoff's sequence: remaining E04 sources, then E05/E06, F01–F03, G01–G03, B01–B03, H01–H03, then the deferred device and human gates.

## 6. Traceability

- **Invariants touched by findings:** creator-controlled sharing (F1); private-by-default and explicit permissions (F2, F3); separately attributed recollections and contributor rights (F5); "Saved only after durable confirmation" was checked and holds in the code read.
- **Anti-drift:** no product behaviour, copy, Foundation document or decision record was changed by this review.
- **Evidence level:** local automated checks and local `workerd` reproduction only. Nothing here is staging, device or human evidence.
