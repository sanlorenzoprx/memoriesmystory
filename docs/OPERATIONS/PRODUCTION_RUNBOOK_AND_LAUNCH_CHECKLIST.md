# Production runbook and launch checklist

**Status:** Prepared 2026-11-16 (lane L8 item 4). Production stays closed: nothing here is authorized until the owner gives the three authorizations in section 3.3 of `docs/EXECUTION/V1_LAUNCH_PARALLEL_HANDOFF_2026-11-16.md`.
**Applies to:** staging first, then production. Each environment has its own Worker, D1, R2, Queue, secrets and identity instance (`ENVIRONMENTS_AND_HANDOFF.md`).

Secrets are entered by the owner in the Cloudflare dashboard, `wrangler secret put`, or GitHub Actions secrets. They never go into chat, the repository or a pull request.

## 1. Provision

| Item | Where | Notes |
| --- | --- | --- |
| Worker, D1, R2, Queue (`PROCESSING_QUEUE`), Workers AI | Cloudflare | Names in `.env.staging.local` for staging; `scripts/deploy-staging.mjs` writes the generated config |
| Durable Object `LegacyRecorder` | `wrangler.jsonc` migrations | Created by the first deploy |
| Rate limiting `REQUEST_LIMIT_PUBLIC` / `COSTLY` / `WRITES` | `wrangler.jsonc` | Production namespaces 4101–4103. Staging uses 5101–5103 (the staging script offsets by 1000) so the two never share counters |
| Daily cron `37 7 * * *` | `wrangler.jsonc` | Runs the integrity (fixity) pass, family update notices and owner reminders |
| `SESSION_SECRET`, `SHARE_TOKEN_PEPPER` | Worker secrets | Distinct per environment; never rotate silently, because rotating `SESSION_SECRET` ends sessions and invalidates unsubscribe links |
| Clerk keys and `CLERK_AUTHORIZED_PARTIES` | Worker secrets and variables | Owner input O3 |
| `ELEVENLABS_API_KEY`, Muse voice id | Worker secrets | Owner input O4 |
| `GEMINI_API_KEY` (preferred) | Worker secret | Muse calls Google directly, billed to the owner's Gemini credits. The key must come from a Google Cloud project with billing on (paid tier); never a free-tier key, whose content Google may use |
| AI Gateway credits or a stored Google key, and optional `AI_GATEWAY_ID` | Cloudflare AI Gateway; Worker variable | Used only when `GEMINI_API_KEY` is not set. Only zero-data-retention models are allowed (`phase1Config.ai.museZeroRetentionModels`). Turn on **Require provider credentials** on the gateway to never spend Cloudflare credits |
| `RESEND_API_KEY` | Worker secret | Primary email provider; the sending domain must be verified in Resend first |
| `EMAIL_FROM_ADDRESS`, `PUBLIC_APP_ORIGIN` | Worker variables | The sender must be on the verified domain; origin like `https://<app host>` |
| Cloudflare Email (second provider) | `wrangler.jsonc` `send_email` binding | Add only after the domain is onboarded; arbitrary recipients need Workers Paid |
| `EMAIL_SENDING_ENABLED` | Worker variable | `"false"` until the owner approves a real send on staging |
| Dead-letter queue `memoriesmystory-processing-dlq` | Cloudflare Queues | Create first, then add `dead_letter_queue` to the consumer |
| Cloudflare Images binding `IMAGES` | `wrangler.jsonc` | Optional: display copies of HEIC photographs; billed per transformation |
| `LEGACY_REMOTE_RECORDING_ENABLED` | Worker variable | `"false"` until remote recording is accepted on staging |

## 2. Migrate

Apply migrations in numeric order, before deploying the Worker that needs them:

```bash
npx wrangler d1 migrations apply <database> --remote --config wrangler.staging.generated.jsonc
```

**Current set:**
- 0001–0026 (0026 is server-built exports)
- 0028 (sharing agreement)
- 0030 (entitlement ledger)
- 0031 (daily ceilings)
- 0038 (owner reminders)
- 0039 (reminder cadence)
- 0040 (what Muse is asked to forget)

Gaps (0027, 0029, 0032–0037) are reserved for lanes and are expected. Each later migration was checked not to depend on them.

Before applying, take a D1 Time Travel bookmark:

```bash
npx wrangler d1 time-travel info <database> --config wrangler.staging.generated.jsonc
```

Record the bookmark in the deployment receipt. See `docs/CURRENT_STATE.md` for the known workaround when a trigger migration fails to apply remotely.

## 3. Deploy

```bash
npm run deploy:staging -- --dry-run
```

```bash
npm run deploy:staging
```

The script refuses the placeholder D1 id and a bundle without the Clerk key. Production uses an equivalent production config only after authorization; `npm run deploy` with the committed `wrangler.jsonc` cannot reach a real environment.

## 4. Verify

1. `GET /health` returns the app identity.
2. Response headers on `/` include the security headers and the report-only Content-Security-Policy (`public/_headers`). Collect CSP reports for a week before enforcing.
3. Run the staging proofs (lane L8 item 2) on synthetic media only:
   - sign-in;
   - capture to completion;
   - share opened and revoked;
   - invitation accepted by the verified recipient;
   - each kind of contribution;
   - album permission;
   - search;
   - export downloaded and checked with **Check an export**;
   - a remote conversation recorded;
   - deletion.
4. The first scheduled run appears in logs:
   - `Fixity pass finished`, with counts only;
   - `Family update pass finished` and `Owner reminder pass finished`, which report `skipped: "email_sending_off"` until email is switched on.
5. `npm run cost:report -- <export.sql>` runs against a D1 export.

## 5. Roll back

- **Worker:**

  ```bash
  npx wrangler rollback --config <config>
  ```

  This returns the previous Worker version. Every migration so far is additive, so an older Worker runs against the newer schema.
- **D1:**

  ```bash
  npx wrangler d1 time-travel restore <database> --bookmark=<bookmark>
  ```

  This restores the pre-migration state. It also discards any writes since the bookmark, so use it only when data is wrong, never just to undo a deploy.
- **Migration compensation notes:**
  - Additive tables and triggers (0022–0026, 0028, 0030, 0031, 0038, 0040) can stay in place under an older Worker.
  - 0028 makes the server require a sharing agreement. An older Worker ignores the table.
  - 0039 drops `owner_reminders_monthly` and adds `owner_reminders_daily`. To compensate, recreate the monthly index only if no person has more than one sent reminder in a month.
  - R2 originals are never rewritten by a deploy. The daily integrity pass records any change.

## 6. Backups and integrity

- D1 Time Travel keeps 30 days of point-in-time history. Take a bookmark before every migration and record it.
- A weekly D1 export (`wrangler d1 export`) is stored outside the account by the owner. A restore rehearsal on staging is required before launch (gate line 5).
- R2 holds the immutable originals. The daily integrity pass re-hashes the least recently checked files and records mismatches. A mismatch or missing object is an incident (section 7).

## 7. Incidents and on-call

| Signal | First response |
| --- | --- |
| `Stored file failed its integrity check` in logs | Treat as data-integrity incident: identify the object by kind and id, never by content; restore from backup; never overwrite without a copy of what is there |
| 5xx rate or `unavailable` codes rising | `wrangler tail`; roll back the Worker if a deploy caused it |
| `rate_limited` or `daily_limit_reached` reported by real families | Raise the thresholds in `wrangler.jsonc` or `phase1Config.dailyCeilings`; a legitimate family must not be limited |
| `Email provider refused a message` | Check Resend status and the domain; Cloudflare Email takes over automatically if configured |
| Transcription failures | Memories stay safe and show a retry; check provider status and the queue |
| Muse questions all look like the fixed fallback | Gemini and Workers AI both failing: check the Gemini key's billing and quota (or AI Gateway credits) and provider status; Muse keeps working with fixed questions |

Logs carry ids, codes and counts only, never story content, addresses or tokens. Keep it that way in any new log line.

## 8. Launch checklist

Each line needs a receipt under `docs/IMPLEMENTATION/` or `docs/EXECUTION/`. Source: section 6 of the launch handoff.

| # | Gate | Status 2026-11-16 |
| --- | --- | --- |
| 1 | Group A capabilities merged or descoped by decision | Mostly merged (albums, export and check, integrity, email with sending off, sharing, referral, ledger, ceilings). Open: L1.3 reload-safe unsent media, L1.4 HEIC viewing copy, stewardship (D7) |
| 2 | Group B complete; no open high-severity finding | Security headers, rate limits, ceilings, error fallback and dependency audit merged. Threat model, route splitting and the automated WCAG 2.2 A/AA scan are done. Open: observability alerts on staging, CSP enforcement, screen-reader review |
| 3 | Legal pages with owner-approved wording, versioned acceptance | Not started; waits on D2 |
| 4 | Whole application on staging with all migrations and staging proofs | Not run; needs O1–O4 |
| 5 | Backup, restore and rollback rehearsed | Not run; needs staging |
| 6 | Device and human acceptance recorded | Not run; scripts and evidence form ready in `docs/EXECUTION/ACCEPTANCE_KIT_V1.md` |
| 7 | Prices and terms approved; sandbox commerce passes | Waits on D1 and O5 |
| 8 | `main` green; release commit recorded | `main` green at each merge; release commit not chosen |
| 9 | Owner's three authorizations | Not given |

**Honest status:** built and tested with synthetic data, not deployed, not proven with real people.
