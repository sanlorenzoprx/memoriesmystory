import { authenticateAppSession, type AuthSessionEnv } from "./auth-session";

/**
 * Email preferences and one-step unsubscribe (lane L2.3).
 *
 * Every optional email kind is opt-in. An unsubscribe link is signed for one
 * person and one kind, works without signing in, and can only turn that kind
 * off for that person. Opening the link changes nothing (mail scanners open
 * links); the change happens on the button press, or on a one-click POST from
 * the mail client (RFC 8058).
 */
export const emailKinds = ["family_updates", "owner_reminders"] as const;
export type EmailKind = (typeof emailKinds)[number];
export const reminderCadences = ["weekly", "biweekly", "monthly"] as const;
export type ReminderCadence = (typeof reminderCadences)[number];
export type EmailPreferences = Record<EmailKind, boolean> & { reminderCadence: ReminderCadence; version: number };

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (value: string) => {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

async function signature(secret: string, userId: string, kind: EmailKind) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${secret}:email-unsubscribe:v1`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${userId}\n${kind}`))),
  );
}

/** A token naming one person and one email kind, signed with the Worker secret. */
export async function unsubscribeToken(secret: string, userId: string, kind: EmailKind) {
  return `${toBase64Url(new TextEncoder().encode(userId))}.${kind}.${await signature(secret, userId, kind)}`;
}

async function readToken(secret: string, token: string | null) {
  const parts = (token ?? "").split(".");
  if (parts.length !== 3 || token!.length > 600) return null;
  const [encoded, kind, signed] = parts as [string, string, string];
  if (!(emailKinds as readonly string[]).includes(kind)) return null;
  let userId: string;
  try {
    userId = new TextDecoder("utf-8", { fatal: true }).decode(fromBase64Url(encoded));
  } catch {
    return null;
  }
  const expected = await signature(secret, userId, kind as EmailKind);
  // Constant-time comparison of equal-length strings.
  if (expected.length !== signed.length) return null;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signed.charCodeAt(i);
  return difference === 0 ? { userId, kind: kind as EmailKind } : null;
}

export async function readEmailPreferences(env: { DB: D1Database }, userId: string): Promise<EmailPreferences> {
  const row = await env.DB.prepare(
    "SELECT family_updates,owner_reminders,reminder_cadence,version FROM email_preferences WHERE user_id=?",
  )
    .bind(userId)
    .first<{ family_updates: number; owner_reminders: number; reminder_cadence: ReminderCadence; version: number }>();
  return {
    family_updates: row?.family_updates === 1,
    owner_reminders: row?.owner_reminders === 1,
    reminderCadence: row?.reminder_cadence ?? "weekly",
    version: row?.version ?? 0,
  };
}

function changeStatements(
  env: { DB: D1Database },
  userId: string,
  next: Record<EmailKind, boolean> & { reminderCadence: ReminderCadence },
  previous: EmailPreferences,
  source: "settings" | "unsubscribe_link",
  now: string,
) {
  const statements = [
    env.DB.prepare(
      `INSERT INTO email_preferences(user_id,family_updates,owner_reminders,reminder_cadence,version,updated_at) VALUES(?1,?2,?3,?5,1,?4)
       ON CONFLICT(user_id) DO UPDATE SET family_updates=?2,owner_reminders=?3,reminder_cadence=?5,version=version+1,updated_at=?4`,
    ).bind(userId, next.family_updates ? 1 : 0, next.owner_reminders ? 1 : 0, now, next.reminderCadence),
  ];
  for (const kind of emailKinds)
    if (next[kind] !== previous[kind])
      statements.push(
        env.DB.prepare(
          "INSERT INTO email_preference_events(user_id,kind,enabled,source,created_at) VALUES(?,?,?,?,?)",
        ).bind(userId, kind, next[kind] ? 1 : 0, source, now),
      );
  return statements;
}

const page = (english: string, spanish: string, form = "") =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Memories: My Story</title><style>body{font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;line-height:1.5}button{font:inherit;padding:12px 20px}</style></head><body><p>${english}</p><p lang="es">${spanish}</p>${form}</body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex",
      },
    },
  );

const kindWording: Record<EmailKind, [string, string]> = {
  family_updates: ["emails when something new is shared with you", "los correos cuando se comparte algo nuevo contigo"],
  owner_reminders: ["reminder emails", "los correos de recordatorio"],
};

export async function handleEmailPreferenceRoute(
  request: Request,
  env: AuthSessionEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === "/resources/email/unsubscribe") {
    if (!env.SESSION_SECRET) return page("This link cannot be used right now.", "Este enlace no se puede usar ahora.");
    const token = url.searchParams.get("t"),
      verified = await readToken(env.SESSION_SECRET, token);
    if (!verified)
      return page("This unsubscribe link is not valid.", "Este enlace para cancelar la suscripción no es válido.");
    const [english, spanish] = kindWording[verified.kind];
    if (request.method === "GET")
      return page(
        `Stop ${english}?`,
        `¿Dejar de recibir ${spanish}?`,
        `<form method="post" action="/resources/email/unsubscribe?t=${encodeURIComponent(token!)}"><button type="submit">Stop these emails · Dejar de recibirlos</button></form>`,
      );
    if (request.method !== "POST") return json({ error: { code: "method" } }, 405);
    const current = await readEmailPreferences(env, verified.userId);
    if (current[verified.kind])
      await env.DB.batch(
        changeStatements(env, verified.userId, { ...current, [verified.kind]: false }, current, "unsubscribe_link", new Date().toISOString()),
      );
    return page(`You will not get ${english} anymore.`, `Ya no recibirás ${spanish}.`);
  }
  if (url.pathname !== "/resources/email/preferences") return null;
  const session = await authenticateAppSession(request, env);
  if (!session) return json({ error: { code: "session_required" } }, 401);
  if (request.method === "GET") return json(await readEmailPreferences(env, session.userId));
  if (request.method !== "PUT") return json({ error: { code: "method" } }, 405);
  if (request.headers.get("X-Memories-Request") !== "email-v1")
    return json({ error: { code: "email_preferences_invalid" } }, 400);
  const body = (await request.json().catch(() => null)) as Partial<EmailPreferences> | null;
  if (
    !body ||
    typeof body.version !== "number" ||
    emailKinds.some((kind) => typeof body[kind] !== "boolean") ||
    (body.reminderCadence !== undefined && !(reminderCadences as readonly string[]).includes(body.reminderCadence))
  )
    return json({ error: { code: "email_preferences_invalid" } }, 400);
  const current = await readEmailPreferences(env, session.userId);
  if (body.version !== current.version) return json({ error: { code: "email_preferences_conflict" } }, 409);
  await env.DB.batch(
    changeStatements(
      env,
      session.userId,
      { family_updates: body.family_updates!, owner_reminders: body.owner_reminders!, reminderCadence: body.reminderCadence ?? current.reminderCadence },
      current,
      "settings",
      new Date().toISOString(),
    ),
  );
  return json(await readEmailPreferences(env, session.userId));
}
