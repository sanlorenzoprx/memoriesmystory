import { readBoundedText } from "./request-body";
import type { AuthSessionEnv } from "./auth-session";
export type FamilyAccessEnv = AuthSessionEnv & {
  MEDIA_BUCKET: R2Bucket;
  CLERK_SECRET_KEY?: string;
};
export type FamilyGrant = {
  id: string;
  archive_id: string;
  owner_user_id: string;
  role: "viewer" | "contributor";
  scope_kind: "archive" | "chapter" | "memory";
  scope_id: string;
  target_email: string;
  state: "pending" | "accepted" | "revoked";
  accepted_by_user_id: string | null;
  version: number;
  expires_at: string;
  created_at: string;
};
export async function grantAllowsMemory(
  env: AuthSessionEnv,
  grant: FamilyGrant,
  memoryId: string,
) {
  const memory = await env.DB.prepare(
    "SELECT id FROM memory_stories WHERE id=? AND owner_user_id=? AND status='complete'",
  )
    .bind(memoryId, grant.owner_user_id)
    .first();
  if (!memory) return false;
  if (grant.scope_kind === "memory") return grant.scope_id === memoryId;
  const found = await env.DB.prepare(
    "SELECT c.id FROM family_chapters c JOIN family_chapter_memories cm ON cm.chapter_id=c.id JOIN family_archives a ON a.id=c.archive_id WHERE cm.memory_story_id=? AND a.id=? AND a.owner_user_id=? AND (?='archive' OR c.id=?) LIMIT 1",
  )
    .bind(
      memoryId,
      grant.archive_id,
      grant.owner_user_id,
      grant.scope_kind,
      grant.scope_id,
    )
    .first();
  return Boolean(found);
}
export async function activeFamilyGrant(
  env: AuthSessionEnv,
  userId: string,
  grantId: string,
  contribute = false,
) {
  const grant = await env.DB.prepare(
    "SELECT g.* FROM family_access_grants g JOIN family_archives a ON a.id=g.archive_id AND a.owner_user_id=g.owner_user_id WHERE g.id=? AND g.accepted_by_user_id=? AND g.state='accepted'",
  )
    .bind(grantId, userId)
    .first<FamilyGrant>();
  return grant && (!contribute || grant.role === "contributor") ? grant : null;
}
// A verified account address is fetched from Clerk; JWT/user-table email claims
// alone never authorize an invitation. No identity data is logged or returned.
export async function verifiedClerkRecipient(
  env: FamilyAccessEnv,
  userId: string,
  targetEmail: string,
): Promise<boolean> {
  if (!env.CLERK_SECRET_KEY) throw new Error("family_identity_unavailable");
  const principal = await env.DB.prepare(
    "SELECT subject FROM auth_principals WHERE user_id=? AND issuer='clerk' LIMIT 1",
  )
    .bind(userId)
    .first<{ subject: string }>();
  if (!principal) return false;
  const response = await fetch(
    `https://api.clerk.com/v1/users/${encodeURIComponent(principal.subject)}`,
    {
      headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok) throw new Error("family_identity_unavailable");
  const profile = JSON.parse(await readBoundedText(response, 65536)) as {
    id?: string;
    email_addresses?: {
      email_address?: string;
      verification?: { status?: string };
    }[];
  };
  if (profile.id !== principal.subject)
    throw new Error("family_identity_unavailable");
  return Boolean(
    profile.email_addresses?.some(
      (address) =>
        address.verification?.status === "verified" &&
        address.email_address?.trim().toLowerCase() === targetEmail,
    ),
  );
}
