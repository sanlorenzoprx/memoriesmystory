# L8 — Staging and release

**Scope:** Whole-application staging deployment and proofs; rollback rehearsal; production runbook and launch checklist; acceptance kit. Deployment needs owner inputs O1–O4.
**Migration numbers:** none
**Owns:** scripts/, .github/workflows/ (except ci.yml), docs/OPERATIONS/, release receipts

The lane updates this file in each pull request. The coordinator folds it into `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `CHANGELOG.md` at merge. Lanes do not edit those three files.

## Status

Not started.

## Merged

None yet.

## Evidence level reached

—

## Next

The first packet in section 4 of `../V1_LAUNCH_PARALLEL_HANDOFF_2026-11-16.md`.

## Provisioning list (collected by the coordinator)

- Dead-letter queue `memoriesmystory-processing-dlq` must be created before `dead_letter_queue` is added to the processing consumer in `wrangler.jsonc` (L7, deferred from PR for L3.2).
- Resend (primary, decision 2026-11-16): verify the sending domain in Resend, store `RESEND_API_KEY` as a Worker secret and set `EMAIL_FROM_ADDRESS` to an address on that domain.
- Cloudflare Email (second): onboard the sending domain (owner input O2), add `"send_email": [{ "name": "EMAIL" }]` to `wrangler.jsonc` (optionally restricted to the sender), set `EMAIL_FROM_ADDRESS`, then set `EMAIL_SENDING_ENABLED` to `"true"` on staging only. Email Sending is in public beta and requires the Workers Paid plan.
- Set `PUBLIC_APP_ORIGIN` (for example `https://<app host>`) so scheduled emails can build their links; until set, the family update pass records nothing.
- Rate limiting namespaces 4101–4103 (`wrangler.jsonc`) need no provisioning; confirm thresholds on staging.
- The daily fixity cron (`37 7 * * *`) runs once deployed; confirm the first pass in staging logs.

## Waiting on the owner

—
