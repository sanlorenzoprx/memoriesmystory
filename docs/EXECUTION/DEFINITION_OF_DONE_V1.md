# Definition of Done v1.0 — Production Ready, Not Live

**Decision:** build the Phase 1 solo Memory Story experience to production-ready evidence, but do not release it to production or the public.

“Production ready” means a release candidate can be deployed by an authorized owner using documented, reversible steps. It does not mean that a build passes or that isolated components work.

## Done only when

### Product outcome

- The complete first-five-minute path works: photo, real voice, recovery, restrained Muse assistance, review, durable completion, private sharing, and the next-story unlock.
- The locked emotional copy, immutable originals, truthful saved state, attribution, truth states, private default, and human/generated distinction remain intact.
- English and Spanish behavior meets the Phase 1 acceptance contract.

### Quality evidence

- Typecheck, lint, unit, integration, build, Cloudflare dry run, and Playwright gates pass from a clean install.
- Failure and recovery paths are tested, including interrupted upload, denied permissions, provider failure, duplicate mutations, and resumed authentication.
- Automated accessibility checks and documented keyboard/screen-reader review meet the WCAG 2.2 AA target.
- Current Android Chrome, current iPhone Safari, a constrained phone profile, and unreliable network behavior have dated evidence.

### Cloudflare staging

- D1 migrations, private R2 object policy, Queue retry/idempotency behavior, and Workers AI bindings are verified in an isolated staging environment.
- At least one English and one Spanish or mixed-language transcription run has a redacted receipt.
- Runtime bindings use `DB`, `MEDIA_BUCKET`, `AI`, and `PROCESSING_QUEUE` consistently.
- A staging deployment and rollback rehearsal succeed without touching production.

### Security, privacy, and operations

- Threat model, data classification, consent, retention, deletion/recovery, rate limits, secure headers, session/CSRF behavior, and log-redaction controls are reviewed.
- Secrets follow `docs/SECURITY/SECRETS_AND_CONFIGURATION.md`; no credential exists in Git history or receipts.
- Observability, alerts, support diagnostics, cost limits, backup/recovery expectations, migration rollback, and incident procedures are documented and exercised proportionately.
- Legal language and provider data-handling decisions required for launch are explicitly approved or recorded as release blockers.

### Handoff

- One canonical repository and commit identify the release candidate.
- The worktree is clean; CI is green; known limitations and unresolved decisions are honest.
- Environment inventory, provisioning steps, deployment/rollback runbook, test evidence, decision log, packet receipts, and one ordered next-action queue are current.
- A new builder can install, verify, run locally, and reproduce staging evidence from the repository instructions without legacy repositories or private family media.

## Never done if

- a required check is skipped without a recorded reason;
- mock output is presented as live-provider evidence;
- secrets or real family media are committed;
- “saved” can appear before durable R2 and D1 confirmation;
- the same failure repeats twice without narrowing or escalation;
- multiple conflicting tasks are marked active;
- the release candidate depends on undocumented local state;
- production has been deployed merely to prove readiness.

## Explicitly outside this gate

- production deployment;
- public launch, traffic migration, or DNS cutover;
- billing activation;
- irreversible deletion or migration of user data;
- automated production secret creation;
- expansion into deferred Memory Circle, public-feed, billing, or video-reel scope.

Those actions require a separate owner-approved launch decision after v1.0 readiness is proven.
