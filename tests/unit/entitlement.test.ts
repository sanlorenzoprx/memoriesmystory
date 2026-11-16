import { describe, expect, it } from "vitest";
import { summarizeLedger } from "../../app/domain/entitlement";

describe("plans and the entitlement ledger (L5.2)", () => {

  it("adds up grants, uses and deletions under either policy", () => {
    const grant = { entry_kind: "grant", granted: 1, used_delta: 0 } as const,
      used = { entry_kind: "memory_completed", granted: 0, used_delta: 1 } as const;
    expect(summarizeLedger([])).toEqual({ granted: 0, used: 0, remaining: 0 });
    expect(summarizeLedger([grant, used])).toEqual({ granted: 1, used: 1, remaining: 0 });
    expect(summarizeLedger([grant, used, { entry_kind: "memory_deleted_capacity_returned", granted: 0, used_delta: -1 }])).toEqual({ granted: 1, used: 0, remaining: 1 });
    expect(summarizeLedger([grant, used, { entry_kind: "memory_deleted_capacity_kept", granted: 0, used_delta: 0 }])).toEqual({ granted: 1, used: 1, remaining: 0 });
  });
});
