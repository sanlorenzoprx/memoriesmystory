import { test, expect } from "@playwright/test";

// Synthetic evidence with a stubbed server: a visitor arriving from a share
// page is counted once per browser session, with nothing but the opaque
// referral id and a random session key.
test("a referred visit is recorded once per session with only the referral id", async ({ page }) => {
  const ref = `ref_${"c3".repeat(12)}`,
    events: Record<string, unknown>[] = [];
  await page.route("**/resources/growth/events", async (route) => {
    expect(route.request().headers()["x-memories-request"]).toBe("growth-v1");
    events.push(route.request().postDataJSON());
    await route.fulfill({ status: 202, json: { recorded: true } });
  });
  await page.goto(`/?ref=${ref}`);
  await expect.poll(() => events.length).toBe(1);
  expect(Object.keys(events[0]!).sort()).toEqual(["event", "key", "ref"]);
  expect(events[0]).toMatchObject({ event: "referred_visitor", ref });
  await page.reload();
  await page.waitForLoadState("networkidle");
  expect(events).toHaveLength(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("memoriesmystory:referral") ?? "null")?.ref)).toBe(ref);
  // A malformed referral is ignored.
  await page.goto("/?ref=not-a-referral");
  await page.waitForLoadState("networkidle");
  expect(events).toHaveLength(1);
});
