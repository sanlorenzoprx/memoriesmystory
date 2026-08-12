import { commerceOffers, type CommerceOfferId } from "./commerce-catalog";

type EntitlementEnv = {
  readonly DB: D1Database;
};

type OrderForGrant = {
  readonly id: string;
  readonly account_id: string;
  readonly offer_id: CommerceOfferId;
  readonly status: string;
  readonly paid_at: string | null;
  readonly fulfilled_at: string | null;
};

export type EntitlementGrant = {
  readonly id: string;
  readonly accountId: string;
  readonly sourceOrderId: string;
  readonly offerId: CommerceOfferId;
  readonly livingMemoryLimit: number;
  readonly voiceSecondsPerMemory: number;
  readonly memoryCircleEnabled: boolean;
  readonly familyArchiveLevel: CommerceOfferId;
  readonly grantedAt: string;
  readonly revokedAt: string | null;
};

type GrantRow = {
  id: string;
  account_id: string;
  source_order_id: string;
  offer_id: CommerceOfferId;
  living_memory_limit: number;
  voice_seconds_per_memory: number;
  memory_circle_enabled: number;
  family_archive_level: CommerceOfferId;
  granted_at: string;
  revoked_at: string | null;
};

function grantFromRow(row: GrantRow): EntitlementGrant {
  return {
    id: row.id,
    accountId: row.account_id,
    sourceOrderId: row.source_order_id,
    offerId: row.offer_id,
    livingMemoryLimit: row.living_memory_limit,
    voiceSecondsPerMemory: row.voice_seconds_per_memory,
    memoryCircleEnabled: row.memory_circle_enabled === 1,
    familyArchiveLevel: row.family_archive_level,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at
  };
}

export async function entitlementForOrder(
  env: EntitlementEnv,
  orderId: string
): Promise<EntitlementGrant | null> {
  const row = await env.DB.prepare(
    `SELECT id, account_id, source_order_id, offer_id, living_memory_limit,
            voice_seconds_per_memory, memory_circle_enabled, family_archive_level,
            granted_at, revoked_at
     FROM entitlement_grants WHERE source_order_id = ?`
  ).bind(orderId).first<GrantRow>();
  return row ? grantFromRow(row) : null;
}

export async function grantPaidOrderEntitlement(
  env: EntitlementEnv,
  orderId: string,
  now = new Date().toISOString()
): Promise<{ readonly grant: EntitlementGrant; readonly replayed: boolean }> {
  const existing = await entitlementForOrder(env, orderId);
  if (existing) return { grant: existing, replayed: true };

  const order = await env.DB.prepare(
    `SELECT id, account_id, offer_id, status, paid_at, fulfilled_at
     FROM commerce_orders WHERE id = ?`
  ).bind(orderId).first<OrderForGrant>();
  if (!order) throw new Error("Commerce order was not found.");
  if (!order.paid_at || (order.status !== "paid" && order.status !== "fulfilled")) {
    throw new Error("Commerce order is not verified as paid.");
  }

  const offer = commerceOffers[order.offer_id];
  const grantId = `grant_${crypto.randomUUID()}`;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO entitlement_grants (
        id, account_id, source_order_id, offer_id, living_memory_limit,
        voice_seconds_per_memory, memory_circle_enabled, family_archive_level,
        granted_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    ).bind(
      grantId,
      order.account_id,
      order.id,
      offer.id,
      offer.livingMemoryLimit,
      offer.voiceSecondsPerMemory,
      offer.memoryCircleEnabled ? 1 : 0,
      offer.familyArchiveLevel,
      now
    ),
    env.DB.prepare(
      `UPDATE commerce_orders
       SET status = 'fulfilled', fulfilled_at = COALESCE(fulfilled_at, ?), updated_at = ?
       WHERE id = ? AND paid_at IS NOT NULL`
    ).bind(now, now, order.id)
  ]);

  const winner = await entitlementForOrder(env, order.id);
  if (!winner) throw new Error("The entitlement grant could not be recorded.");
  return { grant: winner, replayed: winner.id !== grantId };
}

export async function activeEntitlementsForAccount(
  env: EntitlementEnv,
  accountId: string
): Promise<{ readonly grants: EntitlementGrant[]; readonly effective: EntitlementGrant | null }> {
  const rows = await env.DB.prepare(
    `SELECT id, account_id, source_order_id, offer_id, living_memory_limit,
            voice_seconds_per_memory, memory_circle_enabled, family_archive_level,
            granted_at, revoked_at
     FROM entitlement_grants
     WHERE account_id = ? AND revoked_at IS NULL
     ORDER BY granted_at DESC`
  ).bind(accountId).all<GrantRow>();
  const grants = rows.results.map(grantFromRow);
  const rank: Record<CommerceOfferId, number> = { chapter: 1, life: 2, family: 3 };
  const effective = grants.reduce<EntitlementGrant | null>((best, grant) => {
    if (!best || rank[grant.offerId] > rank[best.offerId]) return grant;
    return best;
  }, null);
  return { grants, effective };
}
