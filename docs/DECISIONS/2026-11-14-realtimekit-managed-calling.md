# Managed Cloudflare calling for Our Living Legacy

Status: owner-authorized implementation direction, November 14, 2026. Live acceptance pending.

Authority: after reviewing provider experience and calling/recording costs, the owner favored Cloudflare for global coverage, latency potential and user experience, and instructed us to continue after review of the Cloudflare AI response. That response is research, not application instructions or verified acceptance evidence.

Use Cloudflare RealtimeKit as the initial managed meeting layer over the approved Cloudflare Realtime/SFU foundation. Keep its REST responses and browser SDK outside product/domain contracts. This clarifies the existing Cloudflare-first direction; it does not amend locked Foundation promises. Raw SFU remains a future deliberate engineering/cost decision, not a second-provider fallback or billing toggle.

Reuse existing host authentication, private session/photo access, invitation redemption, guest cookie and individual versioned consent. A guest needs no account. Joining a call does not require recording consent. Permissions are requested only when each person activates the microphone/camera. No Jitsi or external room fallback.

The first implementation is explicitly unrecorded. Force meeting auto-recording, automatic transcription, automatic summaries and livestreaming off; validate a restricted shared preset before issuing participant grants. Do not enable recording until separate audio outputs, composite video, simultaneous recording support/billing, durable archive ingestion and consent withdrawal are verified. Separate participant video is not presently assumed supported. Voice recognition is an optional future consented application capability.

Preserve source photographs and existing recordings. No provider event or live track implies durable archival. Treat “production-ready” and numerical cost/latency claims in the AI answer as hypotheses until supported by current APIs and measured evidence.

Sources: [quickstart](https://developers.cloudflare.com/realtime/realtimekit/quickstart/), [track recording](https://developers.cloudflare.com/realtime/realtimekit/recording-guide/track-recording/), [pricing](https://developers.cloudflare.com/realtime/realtimekit/platform/pricing/). REST paths/shapes checked against the official Cloudflare npm SDK 7.3.0 types; browser SDK 2.0.4. RealtimeKit examples are references only; no application code was inherited.

Current [participant documentation](https://developers.cloudflare.com/realtime/realtimekit/concepts/participant/) documents token validity bodies, refresh behavior and immediate removal by participant deletion. The integration uses bounded grants and provider participant deletion, rather than assuming refresh revokes previous tokens or relying on client polling alone. These newer fields are not represented in the inspected npm REST SDK version; the narrow REST adapter sends the documented body directly.
