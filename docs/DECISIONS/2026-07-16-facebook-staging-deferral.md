# Facebook Staging Deferral

**Status:** accepted interim sequencing decision
**Date:** 2026-07-16

## Context

The isolated Clerk application successfully exercised email and Google sign-in. Its shared Facebook OAuth application returned “App not active.” A custom Meta application then exposed business verification, app review, privacy-policy, and user-data-deletion prerequisites. The product owner chose not to complete that provider work in the current staging pass.

## Decision

Proceed with bounded Packet 4 live staging evidence for email and Google while reporting Facebook as explicitly `deferred`.

This decision changes execution order only. It does not remove Facebook from supported account paths, the Packet 4 phase gate, or the Phase 1 Definition of Done. Packet 4 remains incomplete until a real Facebook sign-in path is verified with redacted evidence.

## Safety boundaries

- `CLERK_FACEBOOK_ENABLED=false` reports `deferred`, not `present`.
- Missing or unrecognized Facebook declarations still fail the preflight.
- No production instance, public Meta submission, business verification, DNS change, or traffic action is authorized.
- Email and Google live evidence cannot be generalized into Facebook acceptance.

## Follow-up evidence

- Complete the Meta privacy, deletion, business, and review prerequisites appropriate to the eventual launch boundary.
- Configure provider credentials privately in Clerk.
- Exercise Facebook sign-in with a staging identity.
- Replace the deferred receipt with dated live evidence before Packet 4 and final acceptance can close.
