# Technical Principles

**Version:** 0.1  
**Status:** Implementation guide subordinate to the constitutional foundation

## Principles

1. Build a complete vertical slice before broad feature expansion.
2. Preserve immutable originals; store enhancements as derived assets with provenance.
3. Model uncertain and disputed human facts explicitly.
4. Make durable-storage confirmation observable and testable.
5. Design every workflow for interruption, retry, and unreliable connectivity.
6. Keep entitlement values in centralized configuration.
7. Keep generated artifacts separate from human-authored and original artifacts.
8. Build localization with BCP 47 identifiers and right-to-left-ready layout from the beginning.
9. Prefer accessible browser-native behavior and progressive enhancement.
10. Make archive export part of the core domain, not an afterthought.
11. Record agreement, share, edit, and deletion events with versioned provenance.
12. Introduce services or provider abstractions only where a real replacement, fallback, or isolation boundary exists.

## Approved platform foundation

- React Router v8 + React + TypeScript + Vite.
- Cloudflare Workers runtime.
- D1 for structured data.
- R2 for original and derived media plus exports.
- Durable Objects for live Memory Circle room state.
- Queues and Workflows for durable background work.
- WebRTC through Cloudflare Realtime/SFU for remote circles.
- Cloud transcription first, with device qualification before local transcription.

See `../ARCHITECTURE/FOUNDATION_STACK.md` for the organized stack record.
