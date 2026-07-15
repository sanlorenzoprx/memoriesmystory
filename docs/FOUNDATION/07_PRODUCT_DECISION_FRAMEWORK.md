# Product Decision Framework

**Version:** 0.1  
**Status:** Required review sequence for meaningful product decisions

For every feature, change, experiment, or cost optimization, answer these questions in order:

1. **Preservation:** Does it help preserve a person's story for future generations?
2. **Truth:** Does it protect original voice, attribution, uncertainty, and differing recollections?
3. **Human experience:** Does it let the person remember naturally without managing technology?
4. **Ownership:** Can the family understand, control, export, and continue the record?
5. **Access:** Does it work for older users, multilingual families, disabilities, lower-powered devices, and interrupted networks?
6. **Durability:** Can the feature recover from failure without losing an original or claiming a false save?
7. **Simplicity:** Is it necessary for the next complete user outcome, or can it wait?
8. **Evidence:** What user evidence, test, or operational receipt will prove it works?
9. **Business fit:** Does monetization or growth reinforce preservation without coercion?
10. **Invariant gate:** Which Product Invariants apply, and is each one protected?

## Decision outcomes

- **Proceed:** Clear North Star value, no invariant conflict, and evidence is defined.
- **Revise:** Valuable idea, but human experience or preservation risk remains.
- **Defer:** Useful later, but not required for the next complete user outcome.
- **Decline:** Does not serve the North Star or violates an invariant.

## Required decision record

Material decisions should be recorded under `docs/DECISIONS/` with:

- context;
- decision;
- alternatives considered;
- affected invariants;
- evidence required;
- consequences;
- date and owner.
