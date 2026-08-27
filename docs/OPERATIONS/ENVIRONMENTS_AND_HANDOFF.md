# Environments and Operations Handoff

## Environment boundary

| Environment | Purpose | Data | Secrets | Deployment authority |
| --- | --- | --- | --- | --- |
| Local | deterministic development and recovery tests | synthetic only | ignored `.dev.vars` | developer/agent |
| Staging | real Cloudflare integration and acceptance | synthetic/non-family fixtures | staging-only Cloudflare secrets | authorized after redacted preflight |
| Production | future public service | future customer data | production-only secrets | closed until separate owner launch approval |

Staging and production use different Worker names/routes, D1 databases, R2 buckets, Queues, OAuth callbacks, Turnstile configuration, session secrets, share peppers, and provider credentials. Secrets do not inherit.

## Required staging resources

- Worker using the `memoriesmystory` technical identity with a staging suffix where Cloudflare uniqueness requires it.
- D1 binding `DB`.
- private R2 binding `MEDIA_BUCKET`.
- Workers AI binding `AI`.
- producer/consumer Queue binding `PROCESSING_QUEUE`, with bounded retry and terminal-failure evidence.
- Turnstile site/secret pair.
- isolated Clerk staging instance with email verification, Google, and Facebook enabled; exact staging origin in `CLERK_AUTHORIZED_PARTIES`.

## Preflight reports only

- account selected;
- required resource present/missing;
- secret present/missing;
- migrations pending/applied;
- callback origin matches/does not match;
- cost/usage guard within/outside limit.

It never reports credential values, OAuth tokens, raw media, transcripts, or share tokens.

For Packet 4, copy `.env.staging.example` to ignored `.env.staging.local`, load values through the operator's private shell, Cloudflare dashboard/secret interface, and Clerk dashboard—never through chat or Git—then run:

```powershell
npm run preflight:identity:staging
```

The command requires the Clerk publishable/secret configuration, `SESSION_SECRET`, exact authorized HTTPS origin, Cloudflare account/deployment authorization, isolated staging Worker/D1/R2 identifiers, and operator confirmation that email and Google are enabled. Facebook must be either `true` after a successful live path or explicitly `false` as an owner-approved interim deferral. A deferred result permits only the separately logged email-and-Google staging checks; it does not complete Packet 4 or final acceptance. The command makes no provider call, and a green result never substitutes for live evidence.

## Scale and operational evidence

Before handoff, record request/error latency, upload failure rate, queue age/retries/dead letters, AI latency/failure/usage, D1 query/index evidence, R2 storage growth, entitlement/share idempotency, and durability-confirmation failures. Establish alerts and a bounded cost response before public launch.

## Required release-candidate handoff

- canonical commit and clean worktree;
- green CI and complete Packet 8 receipt;
- environment/resource inventory with redacted presence checks;
- migration status and rollback/recovery procedure;
- deployment and rollback rehearsal receipt;
- security/privacy review and open legal blockers;
- real-device, accessibility, localization, and live-provider evidence;
- known limitations, current cost observations, incident contacts, and exactly one next action;
- explicit statement that production is not deployed.
