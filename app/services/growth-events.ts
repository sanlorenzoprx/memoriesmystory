/**
 * Content-free growth events (G03). Fire-and-forget: a failed event never
 * interrupts the person, and nothing here grants or unlocks anything. The only
 * thing kept on the device is the opaque referral id from a share page link,
 * for 30 days.
 */
const referralKey = "memoriesmystory:referral",
  visitKey = "memoriesmystory:referral-visit",
  referralPattern = /^ref_[a-f0-9]{24}$/,
  thirtyDays = 30 * 86_400_000;

type GrowthEvent =
  | { event: "share_prompt_viewed"; memoryId: string }
  | { event: "share_started"; memoryId: string; channel: "native" | "whatsapp" | "facebook" | "copy" }
  | { event: "referred_visitor"; ref: string }
  | { event: "referred_first_started" | "referred_first_completed"; ref: string };

export function recordGrowthEvent(body: GrowthEvent, key = crypto.randomUUID().replace(/-/g, "")) {
  void fetch("/resources/growth/events", {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
    headers: { "Content-Type": "application/json", "X-Memories-Request": "growth-v1" },
    body: JSON.stringify({ ...body, key }),
  }).catch(() => undefined);
}

/** Remembers a referral from `?ref=` and records one visit per browser session. */
export function rememberReferral(search: string) {
  const ref = new URLSearchParams(search).get("ref");
  if (!ref || !referralPattern.test(ref)) return;
  try {
    localStorage.setItem(referralKey, JSON.stringify({ ref, at: Date.now() }));
    let visit = sessionStorage.getItem(visitKey);
    if (!visit) {
      visit = crypto.randomUUID().replace(/-/g, "");
      sessionStorage.setItem(visitKey, visit);
      recordGrowthEvent({ event: "referred_visitor", ref }, visit);
    }
  } catch {
    // Storage can be unavailable; the visit simply is not attributed.
  }
}

export function storedReferral(): string | null {
  try {
    const value = JSON.parse(localStorage.getItem(referralKey) ?? "null") as { ref?: string; at?: number } | null;
    if (!value?.ref || !referralPattern.test(value.ref) || typeof value.at !== "number") return null;
    if (Date.now() - value.at > thirtyDays) {
      localStorage.removeItem(referralKey);
      return null;
    }
    return value.ref;
  } catch {
    return null;
  }
}
