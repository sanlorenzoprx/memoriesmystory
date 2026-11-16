import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { museViolations } from "../eval/muse-invariants";
import { fallbackQuestion, normalizeQuestion } from "../../worker/muse-guard";

type Scenario = { id: string; locale: string; transcript: string; candidates: string[] };
const { scenarios } = JSON.parse(readFileSync(new URL("../fixtures/muse/scenarios.json", import.meta.url), "utf8")) as { scenarios: Scenario[] };

describe("Muse evaluation (L6, B01)", () => {
  it("the evaluator itself catches each kind of failure", () => {
    const rosa = scenarios[0]!.transcript;
    expect(museViolations("What do you remember about Rosa's kitchen?", "en-US", rosa)).toEqual([]);
    expect(museViolations("Was that really in Ponce?", "en-US", rosa)).toContain("judgment");
    expect(museViolations("¿Estás seguro de que era en Ponce?", "es-PR", rosa)).toContain("judgment");
    expect(museViolations("What did her sister Carmen bring?", "en-US", rosa)).toContain("invented_name");
    expect(museViolations("How old were you in 1958?", "en-US", rosa)).toContain("invented_number");
    expect(museViolations("What happened? Who was there?", "en-US", rosa)).toContain("not_one_question");
    expect(museViolations("¿Qué recuerdas de la cocina?", "en-US", rosa)).toContain("wrong_language");
    expect(museViolations("Here's a question: what did she sing?", "en-US", rosa)).toContain("preamble");
  });

  for (const scenario of scenarios)
    it(`${scenario.id}: every question a storyteller could see keeps Muse's promises`, () => {
      for (const candidate of scenario.candidates) {
        const shown = normalizeQuestion(candidate, scenario.locale, scenario.transcript);
        expect({ candidate, shown, violations: museViolations(shown, scenario.locale, scenario.transcript) }).toEqual({
          candidate,
          shown,
          violations: [],
        });
      }
      // The fallbacks themselves keep every promise.
      expect(museViolations(fallbackQuestion(scenario.locale), scenario.locale, scenario.transcript)).toEqual([]);
    });

  it("good questions pass through unchanged", () => {
    expect(normalizeQuestion("What do you remember about the smell of the pasteles in Rosa's kitchen?", "en-US", scenarios[0]!.transcript))
      .toBe("What do you remember about the smell of the pasteles in Rosa's kitchen?");
    expect(normalizeQuestion("¿Qué música recuerdas de la boda?", "es-PR", scenarios[4]!.transcript)).toBe("¿Qué música recuerdas de la boda?");
  });
});
