# Documentation Governance Guide

These instructions apply to work under `docs/`.

## Authority order

Use the precedence in `00_START_HERE.md`. Foundation truth governs product controls; product controls govern architecture and implementation. A lower-level document cannot redefine a higher-level promise.

## Document classes

| Class | Examples | Change rule |
| --- | --- | --- |
| Locked constitutional truth | Founding Principles, Product Invariants, Soul, Product Vision | Requires explicit owner approval, a dated decision record, affected-invariant review, and coordinated downstream updates. |
| Binding experience and technical guides | User Experience, Technical Principles, Product Language, AI Behavior Guide | Requires evidence, a documented proposal, explicit approval when behavior changes, and downstream traceability. |
| Product and architecture controls | Canonical Scope, Good Karma policy, stack, repository structure | May be clarified from approved decisions; behavior changes still require a proposal and decision record. |
| Implementation specifications | Phase and packet specifications | Update when approved behavior or verified technical evidence changes; cite the governing source. |
| Receipts and learning records | Implementation receipts, observations, proposals | Append evidence; do not rewrite history to make a result look cleaner. Supersede visibly when needed. |

## Before editing a document

1. Read `00_START_HERE.md` and the document being changed.
2. Search for every reference to the affected term or rule.
3. Check `PRODUCT/OPEN_DECISIONS.md` and `LEARNING/` for unresolved conflicts.
4. Identify the governing source and affected Product Invariants.
5. Decide whether the change is a clarification, implementation evidence, or product-behavior change.

## Controlled update rule

The learning loop may record observations and draft proposals. It may not automatically promote an observation into Foundation truth. Approved changes must update the governing document, dependent specifications, traceability, decision record, tests, and changelog together when applicable.

When evidence contradicts a locked principle, preserve the evidence and escalate the conflict. Do not erase either side and do not silently modify the principle.

Use `LEARNING/README.md` for the complete loop and templates.
