# Test audit — are the tests testing real behaviour?

**Date:** 2026-11-16 (owner question: "make sure our tests are real functions, not 1+1 verifying equals 2").

## Method

All 409 test cases were scanned for assertions that cannot fail (`expect(true).toBe(true)` and the like), tests whose only assertions are `toBeDefined()` or `toBeTruthy()`, and tests that only compare a constant with a literal. The flagged files were then read.

## Findings

| Kind | Count | Verdict |
| --- | --- | --- |
| Assertions that cannot fail | 0 | — |
| Tests asserting only `toBeDefined`/`toBeTruthy` | 0 | The 11 such calls are each followed by stronger checks on the same value |
| "Configuration pin" tests (a setting equals a literal) | 6 | Kept as guard-rails: they fail if someone changes a locked product decision (one free memory, no share reward, private by default, 30-second voice). **Two duplicated others and were removed**, one of them added earlier the same day |
| Route and integration tests | majority | Run the real Worker handlers against a real SQLite database built from every migration, with its triggers. They check what was stored, what was refused, and what never leaked |
| Browser tests (`tests/e2e`) | 99 | Drive the real app in Chromium at phone size. **Most use a stubbed server**, so they prove what a person sees and that truthful-save rules hold. They do not prove the server; the integration suite and staging do |

## What the tests cannot prove (and what does)

- **Real devices, cameras, microphones, mail apps and people:** `docs/EXECUTION/ACCEPTANCE_KIT_V1.md`.
- **Real Cloudflare services** (R2, D1, Queues, Images, email, rate limits): staging proofs, lane L8.
- **Real model behaviour:** `npm run eval:muse` with the owner's credentials.

## Rule going forward

A new test must be able to fail when the behaviour it names breaks. Prefer asserting what was stored, refused or shown over asserting that a function returned something.
