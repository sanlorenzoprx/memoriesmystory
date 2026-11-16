import { describe, expect, it } from "vitest";
import { showsCrisisSignal, supportReply } from "../../worker/muse-safety";

// Decision 2026-11-16 (Talk with Muse): first-person danger is answered with
// real people to reach; memories *about* hard things stay ordinary testimony.
describe("Muse safety check", () => {
  it.each([
    "Honestly I want to die some days.",
    "I don't want to live anymore since she passed.",
    "I'm thinking about ending my life.",
    "Lately I think about ending my life.",
    "I've thought about taking my own life.",
    "I've been thinking about suicide.",
    "Sometimes I think about how to kill myself.",
    "My family would be better off without me.",
    "I've been cutting myself again.",
    "A veces quiero morirme.",
    "Ya no quiero vivir sin ella.",
    "He pensado en quitarme la vida.",
    "Estarían mejor sin mí.",
  ])("answers a person who may be in danger: %s", (text) => {
    expect(showsCrisisSignal(text)).toBe(true);
  });

  it.each([
    "My uncle died by suicide in 1970 and nobody talked about it.",
    "My mother once thought about suicide, she told me years later.",
    "We were dying to see the ocean that summer.",
    "Grandpa killed the chicken himself for Sunday dinner.",
    "I wanted to die of embarrassment when the cake fell!",
    "Mi abuelo murió en la guerra.",
    "Nos moríamos de la risa en la cocina.",
    "She said she would cut the cake after the photo.",
  ])("leaves a memory about hard things as testimony: %s", (text) => {
    expect(showsCrisisSignal(text)).toBe(false);
  });

  it("gives US and Puerto Rico callers 988 and 911, in their language, and says Muse is an AI", () => {
    const english = supportReply("en-US");
    expect(english.message).toContain("I'm an AI");
    expect(english.message).toContain("call or text 988");
    expect(english.message).toContain("call 911");
    expect(english.lines[0]).toMatchObject({ phone: "988", sms: "988" });
    const spanish = supportReply("es-PR");
    expect(spanish.message).toContain("inteligencia artificial");
    expect(spanish.message).toContain("988");
    expect(spanish.message).toContain("en español");
    expect(spanish.emergencyNumber).toBe("911");
  });

  it("never stays silent in a country without an entry", () => {
    for (const locale of ["fr-FR", "es", "en"]) {
      const reply = supportReply(locale);
      expect(reply.emergencyNumber).toBeNull();
      expect(reply.lines[0]!.url).toBe("https://findahelpline.com");
      expect(reply.message).toContain("findahelpline.com");
      expect(reply.message).toMatch(/local emergency number|número de emergencias local/);
    }
  });
});
