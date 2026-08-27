# Configuration

Centralize entitlement limits, thresholds, feature availability, locale profiles, retention rules, and safe runtime configuration. Do not duplicate free/paid limits across UI and service code.

`phase-1.ts` is the Phase 1 source for launch entitlements, media limits, supported MIME types, locales, retention-policy status, AI model-selection status, and share policy. A `null` privacy/provider value is an intentional unresolved gate; code must not silently replace it with a production default.
