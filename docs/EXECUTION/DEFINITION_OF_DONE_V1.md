# Definition of Done v1.1 — Production Ready, Not Live

**Decision:** build the Phase 1 solo **Living Memory** experience to production-ready evidence, but do not release it to production or the public.

“Production ready” means a release candidate can be deployed by an authorized owner using documented, reversible steps. It does not mean that a build passes or that isolated components work.

## Done only when

### Product outcome

- The complete first-five-minute path works: **Photo → Voice → Muse → Preserved → Playback → Invite/Share**.
- The first durable completion can truthfully emit `first_living_memory_completed` under idempotent activation semantics.
- The photograph and authentic voice remain immutable originals; transcript/context/generated artifacts remain derivatives with provenance.
- The completed object is presented as a Living Memory.
- New Living Memories begin private.
- The user can keep private, invite family, or deliberately share without any share-to-unlock reward.
- A Share Artifact preview proves that only selected material crosses the private archive boundary.
- English and Spanish behavior meets the current acceptance contract.

### Quality evidence

- Typecheck, lint, unit, integration, build, Cloudflare dry run, and Playwright gates pass from a clean install.
- Failure and recovery paths are tested, including interrupted upload, denied permissions, provider failure, duplicate mutations, resumed authentication, duplicate activation events, and share-artifact boundary failures.
- Automated accessibility checks and documented keyboard/screen-reader review meet the WCAG 2.2 AA target.
- Current Android Chrome, current iPhone Safari, a constrained phone profile, and unreliable-network behavior have dated evidence.

### Cloudflare staging

- D1 migrations, private R2 object policy, Queue retry/idempotency behavior, and AI bindings are verified in an isolated staging environment.
- At least one English and one Spanish or mixed-language transcription run has a redacted receipt.
- Runtime bindings use `DB`, `MEDIA_BUCKET`, `AI`, and `PROCESSING_QUEUE` consistently where applicable.
- A staging deployment and rollback rehearsal succeed without touching production.

### AI and source grounding

- Muse and generated artifacts are traceable to authorized Living Memory sources.
- AI-suggested facts remain unconfirmed until a person accepts them.
- No generated output is presented as original testimony.
- Failure of transcription or Muse never destroys or invalidates durable original media.

### Security, privacy, sharing, and operations

- Threat model, data classification, consent, retention, deletion/recovery, rate limits, secure headers, session/CSRF behavior, and log-redaction controls are reviewed.
- Private archive retrieval respects ownership and audience scope.
- External sharing uses a bounded Share Artifact and private archive metadata is excluded by default.
- The product truthfully communicates the external-copy boundary.
- Secrets follow `docs/SECURITY/SECRETS_AND_CONFIGURATION.md`; no credential exists in Git history or receipts.
- Observability, alerts, support diagnostics, cost limits, backup/recovery expectations, migration rollback, and incident procedures are documented and exercised proportionately.
- Legal language and provider data-handling decisions required for launch are explicitly approved or recorded as release blockers.

### Handoff

- One canonical repository and commit identify the release candidate.
- The worktree is clean; CI is green; known limitations and unresolved decisions are honest.
- Environment inventory, provisioning steps, deployment/rollback runbook, test evidence, decision log, packet receipts, and one ordered next-action queue are current.
- A new builder can install, verify, run locally, and reproduce staging evidence from repository instructions without legacy repositories or private family media.

## Never done if

- a required check is skipped without a recorded reason;
- mock output is presented as live-provider evidence;
- secrets or real family media are committed;
- “saved” can appear before durable source confirmation;
- a share action can grant another free Living Memory;
- private archive metadata can leak into an external Share Artifact by default;
- generated content can be mistaken for original testimony;
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
- full Memory Circle, broad public-feed, Life Story, legacy-inheritance, or scaled Reel production beyond the approved slice.

Those actions require a separate owner-approved launch decision after readiness is proven.
