# Cost metering report (H01, L5.1)

**Result:** PARTIAL — implemented and proven against fixtures; rates not set, so no dollar figure yet.
**Base:** `main` after PR #67.
**Authority:** V1 launch handoff lane L5 item 1: "A report, not a dashboard. Proof: totals reconcile with test fixtures."

## Outcome

An operator exports the database and runs the report:

```bash
npx wrangler d1 export memoriesmystory --remote --output=d1.sql
```

```bash
npm run cost:report -- d1.sql --from=2026-11-01 --to=2026-12-01
```

The report counts the units that cost money, for each Living Memory completed in the period and in total:
- stored bytes across originals, derivatives, voice replies, family sources and shared-conversation media;
- recorded audio minutes;
- machine transcripts;
- Muse model calls;
- voice replies and their minutes;
- shared conversations and in-person recording minutes;
- failed operations, a proxy for retries.

It also counts emails sent, by purpose (invitations, family update notices and reminders). It names what it does not measure: Muse speech calls, device-side exports, RealtimeKit minutes, and Worker or D1 requests.

## Promises protected

- **Privacy:** it runs on the operator's machine against an export; nothing is sent anywhere. Memories appear only as 12-character one-way ids, and no content is read.
- **Honesty:** a dollar figure appears only when every needed rate is set in `config/cost-rates.json`, so a partial total never looks whole. All rates are `null` until the owner sets them from current provider prices. I invented none.

## Change

- `scripts/cost-report.mjs`: `buildCostReport` and a command-line interface.
- `config/cost-rates.json`, with every rate `null`.
- `package.json`: the `cost:report` script.

## Evidence

| Check | Result |
| --- | --- |
| Integration `tests/integration/cost-report.test.ts` | 2 pass: per-memory units and totals equal the fixture for the chosen period only; ids are one-way; emails by purpose; no cost unless all rates are set; priced totals reconcile by hand |

**Reversible:** yes. **Migration:** none. **Production deployed:** no.
