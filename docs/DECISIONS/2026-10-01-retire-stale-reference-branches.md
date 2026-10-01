# Decision: Retire stale reference branches

**Date:** 2026-10-01  
**Status:** accepted

## Decision

Historical implementation branches are not valid development bases. Their useful history is preserved through closed pull requests, commit SHAs, and this record; the remote branch names are to be deleted.

The only valid branch base is current `origin/main`.

The sole exception is `feat/functional-discovery-surface-01` (PR #13). It remains parked, not active. It must be rebased from current `main` before any future use and must never be used as a base for unrelated work.

## Retired branch snapshots

| Retired branch | Preserved tip | Historical purpose |
| --- | --- | --- |
| `agent/living-memory-landing-contract` | `07605a541a200f11345e10a569a8ec6e1d8e26a0` | Landing contract/reference work; closed PR #5 |
| `agent/living-memory-landing-visual` | `b5b04db8229403ea5cd5b0c0217dd1ac2ba58d16` | Landing visual/reference work; closed PR #6 |
| `agent/value-bearing-cleanup` | `05c0ff49e0e564234c9654b6585336e1df95093f` | August value-bearing cleanup/reference work; closed PR #7 |
| `agent/commerce-slice-a` | `66c6740a00fb8fe4aa35945d8d2ca7e829ef3513` | Early commerce work; closed PR #8 |
| `agent/commerce-slice-b` | `3d9072ace9ad0caa3f8935749332424dd1184c54` | Early commerce work; closed PR #9 |
| `agent/commerce-slice-c` | `c92add0a51ab947baadaf46cba5771c71c21d709` | Early commerce work; closed PR #10 |
| `copy/four-part-persuasion` | `abba7a86def76f46e36366111cfc24e74456fa49` | Superseded customer-copy work; closed PR #14 |

`claude/blissful-euler-l5rsze` is also retired. Before deletion it was fully contained by `main` (zero commits ahead), so it needs no separate archival branch.

## Why

Long-lived reference branches create a false choice for humans and coding agents: an old branch can look like an alternative source of truth even when its architecture, copy, product rules, or provider assumptions are obsolete.

Preserving the commit identity gives us historical recoverability without leaving obsolete work in the normal branch namespace.

## Operating rule

- Start every new change from current `origin/main`.
- Never cherry-pick or copy implementation from a retired branch merely because it already exists.
- If historical work is useful, inspect the recorded PR/commit, then re-derive the smallest current change against today's Foundation, decisions, code, and tests.
- PR #13 is parked evidence, not an alternate product line.
- Do not create "reference branches" in the future. Preserve historical ideas in a PR, decision record, tag, or implementation receipt instead.
