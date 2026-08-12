# Value-Bearing Code Standard

Status: ACTIVE

Purpose: keep `memoriesmystory` clean without deleting proven behavior merely because it is older than the newest presentation layer.

## Governing test

Every retained module, dependency, compatibility layer, route, style sheet, service, or abstraction must be able to answer:

> **What customer outcome or Product Invariant would break if this were deleted?**

If the answer is clear and material, the code is **value-bearing**.

If the answer is only history, convenience, visual duplication, speculative future use, or fear of deletion, the code is **non-value-bearing** and should be removed, collapsed, or isolated.

## Value-bearing examples

Keep behavior that protects:

- original photograph and original human voice;
- recoverable local drafts;
- offline continuation;
- background durability and retry;
- account ownership and cross-device recovery;
- creator-controlled privacy and sharing;
- source provenance;
- the Living Memory Magic Moment;
- accessibility required to complete the journey;
- a verified commercial entitlement or payment boundary.

Implementation details remain replaceable. The protected customer outcome does not.

## Non-value-bearing examples

Remove or collapse:

- superseded landing-page generations;
- duplicate design systems;
- temporary override layers after migration is complete;
- unreachable components;
- tests that exist only to freeze obsolete copy or UI structure;
- wrappers with no current behavior or invariant to protect;
- eager-loaded capability code not needed at the current customer step;
- compatibility code after all real callers have migrated.

## Refactoring rule

Do not use “clean codebase” as permission to erase hard-won behavior.

Preferred sequence:

`PROVEN BEHAVIOR → isolate contract → replace/remove implementation → run behavioral evidence → delete obsolete layer`

A refactor is successful when the codebase is simpler **and** the customer outcome remains intact.

## Customer-journey congruency

Congruency is a functional product requirement, not decoration.

Every route transition should preserve the sense that the customer is still inside one trustworthy product through consistent:

- language;
- hierarchy;
- interaction patterns;
- pacing;
- visual grammar;
- privacy/trust signals;
- remembered intent.

A duplicate or conflicting UI generation is therefore both technical debt and customer-journey debt.

## Loading rule

The customer should not pay the performance cost of a capability before reaching the step that needs it.

Prefer route/capability loading boundaries such as:

`Landing → Identity → Creation → Capture → Archive / Commerce`

Marketing startup should not eagerly import camera/audio runtime, archive runtime, checkout runtime, or identity-provider code unless a measured reason proves that is better.

## Evidence

For material cleanup:

1. identify what is being deleted or isolated;
2. name the customer outcome/invariant retained;
3. run the existing behavioral suite;
4. compare relevant bundle/runtime evidence when performance is part of the change;
5. record the result in the implementation receipt or PR.

## Decision rule

When uncertain, ask a narrower question:

> **Is this code carrying customer value, or merely carrying history?**

Preserve the former. Remove the latter.
