# Remote recording and private source preservation coordinator

Status: implementation decision within the owner's authorized Cloudflare RealtimeKit recording scope; live activation pending verification. No Foundation change.

The owner requested consent-controlled two-person recording, separate participant audio, and verified private archive storage. Provider output probe [43601378648](https://github.com/sanlorenzoprx/memoriesmystory/actions/runs/43601378648) verified simultaneous playable composite video and two mapped audio sources. Managed downloads expire, and recording must stop and be preserved even after both browsers close.

Use one Cloudflare Durable Object per session for persistent alarms and recovery. D1 remains authoritative for consent, ownership, immutable source identity and durability receipts. Private R2 holds untouched downloaded originals under distinct attempt keys; a streaming hash and independent R2 read-back must agree before the D1 receipt commits. No browser state, provider upload status, or successful PUT is sufficient to report an archived original as saved.

A browser-only coordinator cannot guarantee stop/import after departure. A Queue alone does not provide the persistent per-session capture deadline/watchdog used here. This adds no identity provider, guest account requirement, transport fallback, or infrastructure vendor.

Persist allocation intent before each recorder request. An uncertain allocation is reconciled without repeating the start; ambiguous reconciliation closes admission and stops meeting recorders. Both participants can stop; withdrawal persists a stop request and immediately disables that browser's publication. Provider stops are polled before capture is reported stopped. A persistent watchdog closes admission and removes peers at the deadline even during a D1 outage. Actual recording and storage recovery remain separately visible.

Composite video and microphone-specific audio are immutable separate sources. A microphone identity is not automatic human voice recognition; people identify their own voices through separate, additive claims. Partial output is labeled partial. Completeness always requires playback review. No timestamps or speaker alignment are invented from filenames.

Prototype limits are centrally configurable: ten-minute recordings, three starts per owner per UTC day, and 512 MiB per source. These are technical cost guards, not approved paid offers. Live recording defaults off until deployment, migrations, credentials and end-to-end staging verification are complete. Human/device and cross-region acceptance remain separate gates.
