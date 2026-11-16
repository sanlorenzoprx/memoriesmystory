import { describe, expect, it } from "vitest";
import { laneCatalogs } from "../../app/localization/catalog";
import { coreSpanishMessages, spanishMessages } from "../../app/localization/messages";
import { coreErrorMessages } from "../../app/localization/errors";

// Lanes add copy in their own catalog files. A key defined twice would let one
// lane silently override another's wording, so every key must have one owner.
describe("per-lane copy catalogs", () => {
  it("never define the same Spanish key or error code twice", () => {
    const owners = new Map<string, string>();
    const claim = (kind: string, key: string, owner: string) => {
      const id = `${kind}:${key}`;
      expect(owners.get(id), `${id} is defined by ${owners.get(id)} and ${owner}`).toBeUndefined();
      owners.set(id, owner);
    };
    for (const key of Object.keys(coreSpanishMessages)) claim("spanish", key, "core");
    for (const key of Object.keys(coreErrorMessages)) claim("error", key, "core");
    for (const [lane, catalog] of Object.entries(laneCatalogs)) {
      for (const key of Object.keys(catalog.spanish)) claim("spanish", key, lane);
      for (const key of Object.keys(catalog.errors)) claim("error", key, lane);
    }
  });

  it("merges every lane's Spanish into the catalog the interface reads", () => {
    for (const catalog of Object.values(laneCatalogs))
      for (const [key, value] of Object.entries(catalog.spanish)) expect(spanishMessages[key]).toBe(value);
  });

  it("gives every lane error code wording that has a Spanish translation", () => {
    for (const catalog of Object.values(laneCatalogs))
      for (const wording of Object.values(catalog.errors)) expect(spanishMessages[wording], wording).toBeTruthy();
  });
});
