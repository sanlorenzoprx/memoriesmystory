import { authenticateAppSession, sha256Text, type AuthSessionEnv } from "./auth-session";

/**
 * Content-free growth events (G03, lane L4.2), following the voluntary share
 * policy: track the loop, never reward it. No IP address, device fingerprint,
 * user agent, email, testimony or share token is recorded. A referral id is a
 * one-way value derived from a share, so it cannot be turned back into a link.
 */
export type ReferralEnv = AuthSessionEnv & { SHARE_TOKEN_PEPPER?: string };

export const shareChannels = ["native", "whatsapp", "facebook", "copy"] as const;
const referralPattern = /^ref_[a-f0-9]{24}$/,
  keyPattern = /^[A-Za-z0-9_-]{16,80}$/,
  idPattern = /^[A-Za-z0-9_-]{8,160}$/;

export async function referralIdForShare(pepper: string, shareId: string) {
  return `ref_${(await sha256Text(`${pepper}:referral:${shareId}`)).slice(0, 24)}`;
}

/** At most one "opened" event per share per day: opens are not counted per visitor. */
export async function recordShareOpened(
  env: { DB: D1Database },
  input: { shareId: string; storyId: string; referralId: string; now?: Date },
) {
  const now = input.now ?? new Date();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO product_events(id,event_name,user_id,memory_story_id,session_id,referral_id,share_channel,idempotency_key,occurred_at)
     VALUES(?,'living_memory_share_opened',NULL,?,NULL,?,NULL,?,?)`,
  )
    .bind(
      `product_event_${crypto.randomUUID()}`,
      input.storyId,
      input.referralId,
      `share_opened:${await sha256Text(`${input.shareId}:${now.toISOString().slice(0, 10)}`)}`,
      now.toISOString(),
    )
    .run();
}

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });

type EventBody = {
  event?: unknown;
  key?: unknown;
  memoryId?: unknown;
  channel?: unknown;
  ref?: unknown;
};

/**
 * POST /resources/growth/events. Each event is checked against what the
 * server can see (ownership, a real first memory) and collapses duplicates
 * through its idempotency key. Recording an event never grants anything.
 */
export async function handleReferralRoute(request: Request, env: ReferralEnv): Promise<Response | null> {
  if (new URL(request.url).pathname !== "/resources/growth/events") return null;
  if (request.method !== "POST") return json({ error: { code: "method" } }, 405);
  if (request.headers.get("X-Memories-Request") !== "growth-v1")
    return json({ error: { code: "growth_event_invalid" } }, 400);
  const body = (await request.json().catch(() => null)) as EventBody | null;
  const event = body?.event,
    key = body?.key;
  if (typeof event !== "string" || typeof key !== "string" || !keyPattern.test(key))
    return json({ error: { code: "growth_event_invalid" } }, 400);
  const session = await authenticateAppSession(request, env),
    user = session?.userId ?? null,
    ref = typeof body?.ref === "string" && referralPattern.test(body.ref) ? body.ref : null,
    now = new Date().toISOString();
  let name: string,
    memory: string | null = null,
    channel: string | null = null,
    idempotency: string;

  if (event === "share_prompt_viewed" || event === "share_started") {
    if (!user) return json({ error: { code: "session_required" } }, 401);
    const memoryId = typeof body?.memoryId === "string" && idPattern.test(body.memoryId) ? body.memoryId : null;
    const owned =
      memoryId &&
      (await env.DB.prepare("SELECT 1 FROM memory_stories WHERE id=? AND owner_user_id=? AND status='complete'")
        .bind(memoryId, user)
        .first());
    if (!owned) return json({ error: { code: "growth_event_invalid" } }, 400);
    memory = memoryId;
    if (event === "share_started") {
      if (!(shareChannels as readonly string[]).includes(String(body?.channel)))
        return json({ error: { code: "growth_event_invalid" } }, 400);
      channel = String(body!.channel);
      name = "living_memory_share_started";
      idempotency = `share_started:${await sha256Text(`${user}:${key}`)}`;
    } else {
      name = "living_memory_share_prompt_viewed";
      // Once per person per memory, however often the screen is seen.
      idempotency = `share_prompt_viewed:${await sha256Text(`${user}:${memoryId}`)}`;
    }
  } else if (event === "referred_visitor") {
    if (!ref) return json({ error: { code: "growth_event_invalid" } }, 400);
    name = "living_memory_referred_visitor";
    // The key is random per browser session, so a reload is not a new visitor.
    idempotency = `referred_visitor:${await sha256Text(`${ref}:${key}`)}`;
  } else if (event === "referred_first_started" || event === "referred_first_completed") {
    if (!user) return json({ error: { code: "session_required" } }, 401);
    if (!ref) return json({ error: { code: "growth_event_invalid" } }, 400);
    // Only a person's very first memory counts: exactly one draft, or exactly one finished memory.
    const count =
      (
        await env.DB.prepare(
          event === "referred_first_started"
            ? "SELECT count(*) AS n FROM memory_story_drafts WHERE owner_user_id=?"
            : "SELECT count(*) AS n FROM memory_stories WHERE owner_user_id=? AND status='complete'",
        )
          .bind(user)
          .first<{ n: number }>()
      )?.n ?? 0;
    if (count !== 1) return json({ error: { code: "growth_event_not_first" } }, 409);
    name = event === "referred_first_started" ? "referred_first_living_memory_started" : "referred_first_living_memory_completed";
    // Once per person, ever.
    idempotency = `${name}:${await sha256Text(user)}`;
  } else return json({ error: { code: "growth_event_invalid" } }, 400);

  await env.DB.prepare(
    `INSERT OR IGNORE INTO product_events(id,event_name,user_id,memory_story_id,session_id,referral_id,share_channel,idempotency_key,occurred_at)
     VALUES(?,?,?,?,NULL,?,?,?,?)`,
  )
    .bind(`product_event_${crypto.randomUUID()}`, name, user, memory, ref, channel, idempotency, now)
    .run();
  return json({ recorded: true }, 202);
}
