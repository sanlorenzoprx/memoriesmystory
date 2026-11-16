import { test, expect, type Page } from "@playwright/test";
import { translate } from "../../app/localization/messages";

// Synthetic UI evidence with a stubbed server (Talk with Muse M4c): the person
// confirms once, Muse opens by saying it is an AI, replies appear only after
// the server answers, help is one tap away, and a conversation can be deleted.
type Turn = { turnId: string; speaker: string; kind: string; content: string; support?: unknown };

async function stub(page: Page, locale: string) {
  const sent: { text: string; afterTurnId: string }[] = [];
  let confirmed = false,
    talkNumber = 0,
    turns: Turn[] = [];
  const talk = () => ({ talkId: `talk_${String(talkNumber).padStart(32, "0")}`, startedAt: "2026-11-16T10:00:00Z", turns });
  const muse = (kind: string, content: string, extra: object = {}) => ({ turnId: `t${turns.length}`, speaker: "muse", kind, content, ...extra });
  await page.addInitScript((value) => {
    localStorage.setItem("memoriesmystory:ui-locale", value);
    localStorage.setItem("memoriesmystory:welcome-splash", "off");
  }, locale);
  await page.route("**/resources/muse/talk/consent", async (route) => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toEqual({ adult: true, understandsAi: true, disclosureVersion: "muse-talk-disclosure-2026-11-16" });
      confirmed = true;
    }
    await route.fulfill({ json: { confirmed, disclosureVersion: "muse-talk-disclosure-2026-11-16" } });
  });
  await page.route("**/resources/muse/talks", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { talks: [] } });
    talkNumber += 1;
    turns = [muse("greeting", "Hi, I'm Muse. I'm an AI that helps you tell your stories.")];
    return route.fulfill({ status: 201, json: talk() });
  });
  await page.route("**/resources/muse/talks/*/messages", async (route) => {
    const body = route.request().postDataJSON() as { text: string; afterTurnId: string };
    expect(route.request().headers()["x-memories-request"]).toBe("muse-talk-v1");
    sent.push(body);
    turns = [...turns, { turnId: `t${turns.length}`, speaker: "person", kind: "words", content: body.text }];
    if (body.text.includes("die"))
      turns = [...turns, muse("support", "Thank you for telling me. I'm an AI, and I care that you are safe.", {
        support: { lines: [{ label: { en: "988 Suicide & Crisis Lifeline", es: "Línea 988" }, phone: "988", sms: "988", url: null }], emergencyNumber: "911" },
      })];
    else if (body.text.includes("long")) turns = [...turns, muse("family", "We've been talking for a while. Is there one of these stories you'd like to share with someone in your family?")];
    else turns = [...turns, muse("question", "What did the kitchen smell like?")];
    await route.fulfill({ json: talk() });
  });
  await page.route("**/resources/muse/talks/talk_*", async (route) => {
    if (route.request().method() === "DELETE") return route.fulfill({ json: { deleted: true } });
    return route.fulfill({ json: talk() });
  });
  return sent;
}

for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: a person confirms once, talks with Muse, reaches help in one tap, and can delete the conversation`, async ({ page }) => {
    const copy = (key: string, values?: Record<string, string | number>) => translate(key, locale, values);
    const sent = await stub(page, locale);
    await page.goto("/muse");

    const start = page.getByRole("button", { name: copy("Start talking with Muse"), exact: true });
    await expect(start).toBeDisabled();
    await page.getByRole("checkbox", { name: copy("I am 18 or older."), exact: true }).check();
    await expect(start).toBeDisabled();
    await page.getByRole("checkbox", { name: copy("I understand Muse is an AI, not a person."), exact: true }).check();
    await start.click();
    await expect(page.getByText("Hi, I'm Muse. I'm an AI that helps you tell your stories.", { exact: true })).toBeVisible();

    const words = page.getByLabel(copy("Your words"), { exact: true });
    await words.fill("Sundays at my grandmother's house.");
    await page.getByRole("button", { name: copy("Send to Muse"), exact: true }).click();
    await expect(page.getByText("What did the kitchen smell like?", { exact: true })).toBeVisible();
    await expect(words).toHaveValue("");
    expect(sent[0]).toEqual({ text: "Sundays at my grandmother's house.", afterTurnId: "t0" });

    await words.fill("Some days I want to die.");
    await page.getByRole("button", { name: copy("Send to Muse"), exact: true }).click();
    await expect(page.getByRole("link", { name: copy("Call {number}", { number: "988" }), exact: true })).toHaveAttribute("href", "tel:988");
    await expect(page.getByRole("link", { name: copy("Emergency: call {number}", { number: "911" }), exact: true })).toHaveAttribute("href", "tel:911");

    await words.fill("We talked a long time.");
    await page.getByRole("button", { name: copy("Send to Muse"), exact: true }).click();
    await expect(page.getByRole("link", { name: copy("Choose a story to share"), exact: true })).toHaveAttribute("href", "/archive");

    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: copy("Delete this conversation"), exact: true }).click();
    await expect(page.getByText("What did the kitchen smell like?", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Hi, I'm Muse. I'm an AI that helps you tell your stories.", { exact: true })).toBeVisible();
  });
