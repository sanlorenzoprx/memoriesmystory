# Learning and Documentation Memory Loop

This folder is the repository's durable learning memory. It makes evidence, decisions, and document changes inspectable across sessions and contributors.

It is not hidden model memory and it is not permission for an agent to rewrite approved product truth. The repository learns because evidence is recorded, reviewed, approved when necessary, and deliberately promoted into the correct source document.

## The loop

1. **Observe** — record a concrete user response, usability result, production signal, test failure, support pattern, or approved research finding in `OBSERVATIONS.md`.
2. **Interpret** — separate the evidence from the proposed explanation. Note confidence and contrary evidence.
3. **Propose** — create an entry in `CHANGE_PROPOSALS.md` that names the affected documents, code, tests, Product Invariants, risks, and success evidence.
4. **Review** — obtain the level of approval required by `../AGENTS.md`. Product-behavior changes and locked-document changes require explicit owner approval.
5. **Update** — change the governing document first, then dependent specifications, traceability, code, tests, receipt, and changelog as applicable.
6. **Verify** — prove the intended outcome and verify that no higher-authority promise was weakened.
7. **Close or supersede** — record the result without deleting the original observation or proposal.

## Evidence sources

Acceptable inputs include direct product-owner decisions, usability and accessibility sessions, production and reliability signals, automated and manual tests, support themes, opt-in feedback, operational measurements, and approved research with a retrievable source.

Personal family stories, photographs, recordings, and private account data must not be copied into learning records. Record only the minimum anonymized pattern needed to support a decision.

## Status vocabulary

Observations use: `new`, `corroborated`, `disputed`, `addressed`, or `superseded`.

Proposals use: `draft`, `needs evidence`, `awaiting approval`, `approved`, `rejected`, `implemented`, or `superseded`.

## Observation template

```markdown
### L-YYYY-MM-DD-NNN — Short title

- Status:
- Evidence source:
- Observed fact:
- Interpretation:
- Confidence and contrary evidence:
- Affected experience or invariant:
- Related proposal:
```

## Change proposal template

```markdown
### P-YYYY-MM-DD-NNN — Short title

- Status:
- Triggering observations:
- Proposed change:
- Governing documents:
- Affected code and tests:
- Product Invariants protected or at risk:
- Privacy, accessibility, and recovery impact:
- Approval required:
- Success evidence:
- Decision or implementation receipt:
```

## Promotion checklist

A proposal is not implemented until the repository shows the approval source and date, the governing document update or a clear reason none was needed, dependent specification and traceability changes, verification evidence, a dated decision record when material, and a packet receipt/changelog entry when part of a build packet.
