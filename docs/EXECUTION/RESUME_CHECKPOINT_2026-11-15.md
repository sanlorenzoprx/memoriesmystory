# Model-switch resume checkpoint — November 15, 2026

> Historical checkpoint captured before E03 was committed. Refresh live Git/CI and the E03 implementation receipt; this note does not override newer source, CURRENT_STATE or TASK_QUEUE. The completed 53-phone run and focused 7-test replay fix were confirmed when this checkpoint was saved.

Read AGENTS.md and applicable nested guides, then this checkpoint, CURRENT_STATE.md, TASK_QUEUE.json and the complete V2.1 handoff. This is a resume note, not a second task ledger. Current user goal is to complete the entire V2.1 expanded first release; their latest question asks whether the plan is sufficiently detailed to change models and save tokens. No delegation is authorized by the current developer instructions.

## Exact repository state

- Workspace: `/workspace/work/memoriesmystory`.
- Canonical GitHub: `sanlorenzoprx/memoriesmystory`.
- Main/base/current HEAD: `a0c4500e3223e755e574332e511922f362c057a0`, merged PR #42.
- Active branch: `feat/scoped-family-invitations`.
- E03 work is **uncommitted**. Preserve all tracked modifications and untracked source/tests/migration. Do not reset, clean, replace them, or claim they are on main. No E03 PR exists.
- Complete downloadable specification: `/workspace/outputs/Memories_ My Story V2 — Autonomous Engineering Handoff.md` (Version2.1). It retains all37 detailed packets; this checkpoint supersedes its earlier statement that the full53-phone run was pending.

## Proven baseline and current work

PRs21–25 implement solo owner control, editable testimony, voluntary Muse finish, EN/ES, native still/fallback/steadiness and separate scans. PRs26/27/29 and36–39 implement session/consent, in-person/remote recording and durable separate sources. PR40/41 implement private Chapters and native/real-cloud proof; PR42 implements human-entered people/uncertainty/reversible links/history. Main CI43635780025 succeeded; PR42 CI43635510632 succeeded with218 unit/integration and51 phone tests.

Real cloud archive run43628170649 and Chapter extension43634180628 passed with independent R2 hashes, D1 receipts, authorized full/ranged playback, sources surviving Worker redeployment, decoded composite and two mapped microphone sources, provider/storage cleanup. They use temporary synthetic resources; they do not deploy the current full application or prove physical/human/Clerk acceptance. No Jitsi. No Clerk account required for conversation guests. Both Cloudflare tokens already work in GitHub Actions; never request their values or repeat setup.

E03 local files include migration0016_scoped_family_access.sql, worker/family-permissions.ts and family-access-routes.ts, app/domain and services/family-access.ts, owner FamilyInvitationsPanel, recipient FamilyAccessExperience, identity returnTo whitelist, route wiring, EN/ES messages, scoped permission tests and native runtime extensions.

Features: verified-Clerk-email intended-recipient acceptance (fresh server profile, not unverified email claims), expiring hashed invitation tokens, stable account binding, viewer/contributor roles, default one-memory scope with explicit Chapter/archive scopes, current-scope permission checks, private photo/voice URLs, revocation checks after R2 awaits, versioned events, owner inventory and manual copy-link transport. Contributor authorization is foundation only; E04 contributions are not implemented. Member viewing deliberately excludes unrelated/private people/history/context and raw storage links.

## Latest verification

- Local core passed226 tests/52files, typecheck/lint,77 required schema objects/integrity/FKs, build and Cloudflare dry run.
- **Full53 phone-Chromium tests passed** on resumption (2.0min), including new EN/ES invitation journeys. This is viewport emulation, not physical phones.
- Last security/recovery review found an async error-boundary issue: replayCreation promises were returned without awaiting inside the handler try/catch. The uncommitted patch now uses `return await replayCreation(...)` for both original and race-winner replays. A revoked-invite retry assertion was added to family-access.test.ts. Its focused7-test suite was rerun after the patch; consult the session/tool result and run it if that result is unavailable. Full core/CI must verify the final committed candidate.
- Initial localization failure for “Original voice” was fixed; subsequent core passed. Do not weaken the catalog test.
- Build still reports the existing large-bundle warning. Do not run builds while browser tests use dist.

## Exact next action

Finish E03 review, record its implementation receipt and learning evidence, update CURRENT_STATE/TASK_QUEUE to actual evidence, format explicit changed files, run final appropriate checks, commit/push a scoped branch, create PR, await clean-install Verify, and merge only the expected reviewed head under existing user authorization. Hosted Clerk recipient acceptance remains unproven; do not present fixture identity adapters as a live identity proof. Do not merge E03 before CI or mark the complete Family Archive/V2 finished.

Next packets: E04 distinct attributed voice/text/photo contributions and owner assembly; E05/E06 authorized search/citations/timeline/opt-in resurfacing; F01/F03 complete source-inclusive export/hash/restore/fixity; F02 concrete stewardship/recovery controls and approved operative policy; G01 minimum reviewed grounded derivative and G02/G03 bounded distribution/referrals; B01–03 measured Muse evaluation/model decision; H01–03 measured configurable offers and Stripe sandbox fulfillment/refund/cost controls; final staging/rollback/security/device/human acceptance.

Originals remain immutable; generated/edited/human-source material stays distinguishable; saved requires durable proof. One active packet and task ledger. Keep production and live billing closed. Prepare concrete reviewable policy/offers before requesting owner decisions. Owner deferred physical camera testing until the complete MVPv0.5 implementation. Automatic voice recognition, a full participant-transcription workflow, long-term retention, legal approval, stewardship and full V2 acceptance are not proved by the existing recording sources.

## Commands and access

Use Node22-compatible locked project commands. Environment prefixes:

```
XDG_CONFIG_HOME=/tmp/memoriesmystory-config
WRANGLER_LOG_PATH=/tmp/memoriesmystory-wrangler-logs
PLAYWRIGHT_BROWSERS_PATH=/tmp/memoriesmystory-browsers
```

`npm run verify:core` then `npx playwright test` sequentially. Use `npm_config_cache=/tmp/memoriesmystory-npm-cache` for temporary npx formatting if needed. GitHub CLI is authenticated; secrets cannot be retrieved from it. Existing Actions privately consume REALTIMEKIT_API_TOKEN/CLOUDFLARE_API_TOKEN and REALTIMEKIT_ACCOUNT_ID. Never expose credentials/media/transcripts/provider bodies in receipts. No .env.staging.local or direct workspace Cloudflare credentials are present. No production/full-app deployment was performed.

The previously stated ~60% remaining is a rough planning estimate across implementation and release acceptance, not measured progress, a promise, or a test-derived score. Prefer packet/evidence status when reporting progress.
