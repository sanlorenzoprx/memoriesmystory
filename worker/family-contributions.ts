import { authenticateAppSession, sha256Text } from "./auth-session";
import {
  activeFamilyGrant,
  grantAllowsMemory,
  type FamilyAccessEnv,
} from "./family-permissions";
import {
  readBoundedBytes,
  readBoundedText,
  RequestBodyTooLarge,
} from "./request-body";
import { hasMediaSignature } from "./media-routes";
import { phase1Config } from "../config/phase-1";
const limits = phase1Config.familyContributions,
  idPattern = /^[A-Za-z0-9_-]{8,120}$/;
class ContributionError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
function fail(status: number, code = "family_contribution_invalid"): never {
  throw new ContributionError(status, code);
}
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
function id(value: unknown): string {
  if (typeof value !== "string" || !idPattern.test(value)) fail(400);
  return value;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    fail(400);
  return value.trim();
}
const voiceExtensions: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
};
const photoExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};
type VoiceSource = {
  id: string;
  r2_key: string;
  content_type: string;
  byte_size: number;
  sha256: string;
};
type Row = {
  id: string;
  memory_story_id: string;
  owner_user_id: string;
  author_user_id: string;
  author_state: string;
  latest_revision_id: string;
  included_revision_id: string | null;
  version: number;
};
// The first mutation statement checks current permission inside the atomic batch,
// rather than trusting authorization that might have changed during an await.
const permission = `EXISTS(SELECT 1 FROM memory_stories pm WHERE pm.id=? AND pm.status='complete' AND (pm.owner_user_id=? OR EXISTS(SELECT 1 FROM family_access_grants pg WHERE pg.id=? AND pg.accepted_by_user_id=? AND pg.owner_user_id=pm.owner_user_id AND pg.state='accepted' AND (?=0 OR pg.role='contributor') AND ((pg.scope_kind='memory' AND pg.scope_id=pm.id) OR (pg.scope_kind<>'memory' AND EXISTS(SELECT 1 FROM family_chapter_memories pcm JOIN family_chapters pc ON pc.id=pcm.chapter_id WHERE pcm.memory_story_id=pm.id AND pc.archive_id=pg.archive_id AND (pg.scope_kind='archive' OR pc.id=pg.scope_id)))))))`;
const visibleSource = `(c.author_user_id=c.owner_user_id OR EXISTS(SELECT 1 FROM family_access_grants sg WHERE sg.id=v.source_grant_id AND sg.state='accepted' AND sg.accepted_by_user_id=c.author_user_id AND sg.owner_user_id=c.owner_user_id AND sg.role='contributor' AND ((sg.scope_kind='memory' AND sg.scope_id=c.memory_story_id) OR (sg.scope_kind<>'memory' AND EXISTS(SELECT 1 FROM family_chapter_memories scm JOIN family_chapters sc ON sc.id=scm.chapter_id WHERE scm.memory_story_id=c.memory_story_id AND sc.archive_id=sg.archive_id AND (sg.scope_kind='archive' OR sc.id=sg.scope_id))))))`;
const pinnedVisibleSource = visibleSource.replace(/\bv\./g, "pinned.");
export async function handleFamilyContributionRoute(
  request: Request,
  env: FamilyAccessEnv,
): Promise<Response | null> {
  const url = new URL(request.url),
    match = url.pathname.match(
      /^\/resources\/family-contributions\/([^/]+)(?:\/([^/]+)(?:\/(revise|assembly|withdraw|history|voice|photo|transcript|transcript-assembly))?)?$/,
    );
  if (!match) return null;
  try {
    const session = await authenticateAppSession(request, env);
    if (!session) fail(401, "session_required");
    const user = session.userId,
      memoryId = id(match[1]),
      uploadKind =
        (match[2] === "voice" || match[2] === "photo") && !match[3]
          ? match[2]
          : null,
      contributionId = match[2] && !uploadKind ? id(match[2]) : null,
      action = match[3];
    const memory = await env.DB.prepare(
      "SELECT owner_user_id FROM memory_stories WHERE id=? AND status='complete'",
    )
      .bind(memoryId)
      .first<{ owner_user_id: string }>();
    if (!memory) fail(404, "family_contribution_not_found");
    const isOwner = memory.owner_user_id === user,
      grantId = url.searchParams.get("grantId");
    if (grantId) id(grantId);
    const current = contributionId
      ? await env.DB.prepare(
          "SELECT * FROM family_contributions WHERE id=? AND memory_story_id=?",
        )
          .bind(contributionId, memoryId)
          .first<Row>()
      : null;
    if (contributionId && !current) fail(404, "family_contribution_not_found");
    const withdrawing =
      action === "withdraw" && current?.author_user_id === user;
    let canRead = isOwner,
      canWrite = isOwner;
    if (!isOwner && grantId) {
      const grant = await activeFamilyGrant(env, user, grantId);
      if (grant && (await grantAllowsMemory(env, grant, memoryId))) {
        canRead = true;
        canWrite = grant.role === "contributor";
      }
    }
    if (
      !canRead &&
      !withdrawing &&
      !(
        (action === "history" ||
          action === "voice" ||
          action === "photo" ||
          (action === "transcript" && request.method === "GET")) &&
        current?.author_user_id === user
      )
    )
      fail(403, "family_contribution_denied");
    const guardParams = [memoryId, user, grantId ?? "", user, 1];
    if (request.method === "GET") {
      if (action === "history" && current) {
        if (!isOwner && current.author_user_id !== user)
          fail(403, "family_contribution_denied");
        const after = url.searchParams.get("after");
        if (after) id(after);
        const rows = (
          await env.DB.prepare(
            "SELECT id,attribution,human_text,source_kind,created_at,previous_revision_id FROM family_contribution_sources WHERE contribution_id=? AND id>? ORDER BY id LIMIT ?",
          )
            .bind(current.id, after ?? "", limits.pageSize + 1)
            .all<{
              id: string;
              attribution: string;
              human_text: string;
              source_kind: string;
              created_at: string;
              previous_revision_id: string | null;
            }>()
        ).results;
        return json({
          id: current.id,
          version: current.version,
          authorState: current.author_state,
          revisions: rows.slice(0, limits.pageSize).map((v) => ({
            id: v.id,
            attribution: v.attribution,
            text: v.human_text,
            sourceKind: v.source_kind,
            createdAt: v.created_at,
            previousRevisionId: v.previous_revision_id,
          })),
          nextCursor:
            rows.length > limits.pageSize
              ? rows[limits.pageSize - 1]!.id
              : null,
        });
      }
      if (action === "transcript" && current) {
        // Earlier written words are private source history for the speaker and owner.
        if (!isOwner && current.author_user_id !== user)
          fail(403, "family_contribution_denied");
        const after = Number(url.searchParams.get("after") ?? 0);
        if (!Number.isSafeInteger(after) || after < 0) fail(400);
        const rows = (
          await env.DB.prepare(
            "SELECT rowid AS seq,id,written_text,created_at FROM family_contribution_voice_transcripts WHERE contribution_id=? AND rowid>? ORDER BY rowid LIMIT ?",
          )
            .bind(current.id, after, limits.pageSize + 1)
            .all<{
              seq: number;
              id: string;
              written_text: string;
              created_at: string;
            }>()
        ).results;
        return json({
          id: current.id,
          version: current.version,
          transcripts: rows.slice(0, limits.pageSize).map((row) => ({
            id: row.id,
            text: row.written_text,
            createdAt: row.created_at,
          })),
          nextCursor:
            rows.length > limits.pageSize
              ? String(rows[limits.pageSize - 1]!.seq)
              : null,
        });
      }
      if ((action === "voice" || action === "photo") && current) {
        // The author and owner may always hear the source. Invited family hears
        // only the version the owner included, while its source grant still holds.
        const mayHear = async () =>
          isOwner ||
          current.author_user_id === user ||
          Boolean(
            (await env.DB.prepare(
              `SELECT 1 AS ok FROM family_contributions c JOIN family_contribution_sources v ON v.id=c.included_revision_id AND v.contribution_id=c.id WHERE c.id=? AND c.author_state='submitted' AND v.source_kind=? AND ${visibleSource}`,
            )
              .bind(current.id, `human_${action}`)
              .first()) &&
              (await env.DB.prepare(`SELECT 1 AS ok WHERE ${permission}`)
                .bind(memoryId, user, grantId ?? "", user, 0)
                .first()),
          );
        const source = await env.DB.prepare(
          `SELECT id,r2_key,content_type,byte_size,sha256 FROM family_contribution_${action}_sources WHERE contribution_id=?`,
        )
          .bind(current.id)
          .first<VoiceSource>();
        if (!source) fail(404, "family_contribution_not_found");
        if (!(await mayHear())) fail(403, "family_contribution_denied");
        const ranged = /^bytes=\d*-\d*$/.test(
          request.headers.get("Range") ?? "",
        );
        const object = ranged
          ? await env.MEDIA_BUCKET.get(source.r2_key, {
              range: request.headers,
            })
          : await env.MEDIA_BUCKET.get(source.r2_key);
        if (!object) fail(503, "family_contribution_unavailable");
        // Re-check after the storage await before sending private bytes.
        if (!(await mayHear())) fail(403, "family_contribution_denied");
        const headers = new Headers({
          "Content-Type": source.content_type,
          "Cache-Control": "private, no-store",
          "Accept-Ranges": "bytes",
          "X-Content-Type-Options": "nosniff",
          "X-Content-SHA256": source.sha256,
          "Referrer-Policy": "no-referrer",
        });
        const range = object.range;
        if (
          ranged &&
          range &&
          "offset" in range &&
          typeof range.offset === "number"
        ) {
          const length = range.length ?? source.byte_size - range.offset;
          if (range.offset > 0 || length < source.byte_size) {
            headers.set("Content-Length", String(length));
            headers.set(
              "Content-Range",
              `bytes ${range.offset}-${range.offset + length - 1}/${source.byte_size}`,
            );
            return new Response(object.body, { status: 206, headers });
          }
        }
        headers.set("Content-Length", String(source.byte_size));
        return new Response(object.body, { headers });
      }
      if (action) fail(404, "family_contribution_not_found");
      const after = url.searchParams.get("after");
      if (after) id(after);
      const rows = (
        await env.DB.prepare(
          `SELECT c.*,CASE WHEN c.author_state='submitted' AND c.included_revision_id IS NOT NULL AND ${pinnedVisibleSource} THEN 1 ELSE 0 END AS family_visible,CASE WHEN ${visibleSource} THEN 1 ELSE 0 END AS source_available,v.id AS revision_id,v.attribution,v.human_text,v.source_kind,v.duration_ms,v.content_type AS voice_content_type,v.created_at AS revision_created FROM family_contributions c JOIN family_contribution_sources v ON v.contribution_id=c.id AND v.id=CASE WHEN c.owner_user_id=? OR c.author_user_id=? THEN c.latest_revision_id ELSE c.included_revision_id END LEFT JOIN family_contribution_sources pinned ON pinned.id=c.included_revision_id AND pinned.contribution_id=c.id WHERE c.memory_story_id=? AND c.id>? AND (?='' OR c.id=?) AND (c.owner_user_id=? OR c.author_user_id=? OR (c.author_state='submitted' AND c.included_revision_id IS NOT NULL AND ${visibleSource})) ORDER BY c.id LIMIT ?`,
        )
          .bind(
            user,
            user,
            memoryId,
            after ?? "",
            contributionId ?? "",
            contributionId ?? "",
            user,
            user,
            limits.pageSize + 1,
          )
          .all<
            Row & {
              revision_id: string;
              family_visible: number;
              source_available: number;
              attribution: string;
              human_text: string;
              source_kind: string;
              duration_ms: number | null;
              voice_content_type: string | null;
              revision_created: string;
            }
          >()
      ).results;
      // A final read fence excludes sources after revocation/scope loss during fetch.
      const authorized = await env.DB.prepare(
        `SELECT 1 AS ok WHERE ${permission}`,
      )
        .bind(memoryId, user, grantId ?? "", user, 0)
        .first();
      if (!authorized) fail(403, "family_contribution_denied");
      const page = rows.slice(0, limits.pageSize);
      const spoken = page
        .filter((c) => c.source_kind === "human_voice")
        .map((c) => c.id);
      const words = spoken.length
        ? (
            await env.DB.prepare(
              `SELECT t.id,t.contribution_id,t.written_text,t.created_at,p.transcript_id AS pinned,CASE WHEN t.rowid=(SELECT max(rowid) FROM family_contribution_voice_transcripts x WHERE x.contribution_id=t.contribution_id) THEN 1 ELSE 0 END AS latest FROM family_contribution_voice_transcripts t LEFT JOIN family_contribution_transcript_pins p ON p.contribution_id=t.contribution_id WHERE t.contribution_id IN (${spoken.map(() => "?").join(",")}) AND (t.id=p.transcript_id OR t.rowid=(SELECT max(rowid) FROM family_contribution_voice_transcripts x WHERE x.contribution_id=t.contribution_id))`,
            )
              .bind(...spoken)
              .all<{
                id: string;
                contribution_id: string;
                written_text: string;
                created_at: string;
                pinned: string | null;
                latest: number;
              }>()
          ).results
        : [];
      const wordsView = (row?: (typeof words)[number]) =>
        row
          ? { id: row.id, text: row.written_text, createdAt: row.created_at }
          : null;
      const contributions = page.map((c) => ({
        id: c.id,
        memoryId,
        version: c.version,
        authorState: c.author_state,
        own: c.author_user_id === user,
        canAssemble: isOwner,
        familyVisible: Boolean(c.family_visible),
        canInclude:
          isOwner &&
          c.author_state === "submitted" &&
          Boolean(c.source_available),
        latestRevisionId:
          isOwner || c.author_user_id === user
            ? c.latest_revision_id
            : c.revision_id,
        includedRevisionId: c.included_revision_id,
        revision: {
          id: c.revision_id,
          attribution: c.attribution,
          text: c.human_text,
          sourceKind: c.source_kind,
          createdAt: c.revision_created,
        },
        voice:
          c.source_kind === "human_voice"
            ? { durationMs: c.duration_ms, contentType: c.voice_content_type }
            : null,
        photo:
          c.source_kind === "human_photo"
            ? { contentType: c.voice_content_type }
            : null,
        // The speaker's own written words. Family receives only the owner-pinned
        // version, and only while the voice itself is family-visible.
        writtenWords:
          c.source_kind === "human_voice"
            ? {
                latest:
                  isOwner || c.author_user_id === user
                    ? wordsView(
                        words.find(
                          (w) => w.contribution_id === c.id && w.latest,
                        ),
                      )
                    : null,
                included:
                  isOwner || c.author_user_id === user || c.family_visible
                    ? wordsView(
                        words.find(
                          (w) => w.contribution_id === c.id && w.pinned === w.id,
                        ),
                      )
                    : null,
              }
            : null,
      }));
      if (contributionId) {
        if (!contributions.length) fail(404, "family_contribution_not_found");
        return json({ contribution: contributions[0] });
      }
      return json({
        canContribute: canWrite,
        draftScope: await sha256Text(`contribution-draft:${user}:${memoryId}`),
        contributions,
        nextCursor: rows.length > limits.pageSize ? page.at(-1)!.id : null,
      });
    }
    if (request.method !== "POST") fail(405, "method");
    if (
      request.headers.get("X-Memories-Request") !== "family-v1" ||
      (request.headers.has("Origin") &&
        request.headers.get("Origin") !== url.origin)
    )
      fail(403, "csrf");
    if (uploadKind) {
      const photo = uploadKind === "photo";
      if (!canWrite) fail(403, "family_contribution_denied");
      if (
        request.headers.get("X-Contribution-Agree") !== "true" ||
        request.headers.get("X-Agreement-Version") !== limits.agreementVersion
      )
        fail(400, "family_contribution_consent");
      let named = "";
      try {
        named = decodeURIComponent(
          request.headers.get("X-Contribution-Attribution") ?? "",
        );
      } catch {
        fail(400);
      }
      const attribution = text(named, limits.attributionCharacters),
        contentType =
          (request.headers.get("Content-Type") ?? "")
            .split(";")[0]
            ?.trim()
            .toLowerCase() ?? "",
        extension = (photo ? photoExtensions : voiceExtensions)[contentType],
        contentSha = (
          request.headers.get("X-Content-SHA256") ?? ""
        ).toLowerCase(),
        durationMs = photo
          ? null
          : Number(request.headers.get("X-Audio-Duration-MS")),
        code = (suffix: string) =>
          `family_contribution_${uploadKind}_${suffix}`;
      if (!extension) fail(415, code("format"));
      if (!/^[a-f0-9]{64}$/.test(contentSha)) fail(400, code("unconfirmed"));
      if (
        durationMs !== null &&
        (!Number.isSafeInteger(durationMs) ||
          durationMs < 100 ||
          durationMs > limits.voiceSeconds * 1000 + 1000)
      )
        fail(400, code("length"));
      const key = id(request.headers.get("X-Idempotency-Key")),
        receiptKey = `contribution_${await sha256Text(`${user}:contribution_${uploadKind}:${key}`)}`,
        requestHash = await sha256Text(
          JSON.stringify({
            kind: uploadKind,
            memoryId,
            grantId,
            attribution,
            contentSha,
            contentType,
            durationMs,
          }),
        );
      const prior = async () => {
        const row = await env.DB.prepare(
          "SELECT request_hash,result_ref FROM operation_receipts WHERE idempotency_key=? AND scope_type='user' AND scope_id=?",
        )
          .bind(receiptKey, user)
          .first<{ request_hash: string; result_ref: string }>();
        if (row && row.request_hash !== requestHash)
          fail(409, "idempotency_conflict");
        return row ? JSON.parse(row.result_ref) : null;
      };
      const old = await prior();
      if (old) return json({ ...old, replayed: true });
      let bytes: Uint8Array<ArrayBuffer>;
      try {
        bytes = await readBoundedBytes(
          request,
          photo ? limits.photoBytes : limits.voiceBytes,
        );
      } catch (error) {
        if (error instanceof RequestBodyTooLarge)
          fail(413, code(photo ? "size" : "length"));
        throw error;
      }
      if (!bytes.byteLength) fail(400, code("unconfirmed"));
      if (!hasMediaSignature(bytes, contentType)) fail(415, code("format"));
      const digest = [
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      ]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      if (digest !== contentSha) fail(400, code("unconfirmed"));
      const guard = [memoryId, user, grantId ?? "", user, 1];
      // Never place a voice in storage for someone whose access already ended.
      if (
        !(await env.DB.prepare(`SELECT 1 AS ok WHERE ${permission}`)
          .bind(...guard)
          .first())
      )
        fail(403, "family_contribution_denied");
      const now = new Date().toISOString(),
        sourceId = `family_contribution_${(await sha256Text(receiptKey)).slice(0, 40)}`,
        voiceId = `contribution_${uploadKind}_${(await sha256Text(`${receiptKey}:${uploadKind}`)).slice(0, 40)}`,
        // Each attempt has its own key, so a retry never overwrites an earlier original.
        r2Key = `contributions/${memoryId}/${sourceId}/${crypto.randomUUID()}/original.${extension}`,
        result = { id: sourceId, version: 1 };
      const discard = () => env.MEDIA_BUCKET.delete(r2Key).catch(() => {});
      let etag: string;
      try {
        const stored = await env.MEDIA_BUCKET.put(r2Key, bytes, {
          httpMetadata: { contentType, cacheControl: "private, no-store" },
          customMetadata: { memoryId, contributionId: sourceId },
          sha256: contentSha,
        });
        const head = await env.MEDIA_BUCKET.head(r2Key),
          readback = await env.MEDIA_BUCKET.get(r2Key);
        if (
          !stored ||
          !head ||
          !readback ||
          head.size !== bytes.byteLength ||
          head.etag !== stored.etag
        )
          throw new Error("unconfirmed");
        const stream = new Uint8Array(await readback.arrayBuffer()),
          again = [
            ...new Uint8Array(await crypto.subtle.digest("SHA-256", stream)),
          ]
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
        if (again !== contentSha) throw new Error("unconfirmed");
        etag = head.etag;
      } catch {
        await discard();
        fail(503, code("unconfirmed"));
      }
      try {
        const results = await env.DB.batch([
          env.DB.prepare(
            `INSERT INTO family_contributions(id,memory_story_id,owner_user_id,author_user_id,author_state,latest_revision_id,created_at,updated_at) SELECT ?,?,?,?,'submitted',?,?,? WHERE ${permission} AND (SELECT count(*) FROM family_contributions WHERE memory_story_id=?)<?`,
          ).bind(
            sourceId,
            memoryId,
            memory.owner_user_id,
            user,
            voiceId,
            now,
            now,
            ...guard,
            memoryId,
            limits.maximumPerMemory,
          ),
          env.DB.prepare(
            "INSERT INTO operation_receipts(idempotency_key,operation_kind,scope_type,scope_id,request_hash,status,result_ref,correlation_id,created_at,updated_at) SELECT ?,?,'user',?,?,'succeeded',?,?,?,? WHERE changes()=1",
          ).bind(
            receiptKey,
            `contribution_${uploadKind}`,
            user,
            requestHash,
            JSON.stringify(result),
            receiptKey,
            now,
            now,
          ),
          env.DB.prepare(
            `INSERT INTO family_contribution_${uploadKind}_sources(id,contribution_id,author_user_id,source_grant_id,attribution,agreement_version,r2_key,content_type,byte_size,sha256,r2_etag,created_at${photo ? "" : ",duration_ms"}) SELECT ?,?,?,?,?,?,?,?,?,?,?,?${photo ? "" : ",?"} WHERE EXISTS(SELECT 1 FROM operation_receipts WHERE idempotency_key=? AND request_hash=?) AND EXISTS(SELECT 1 FROM family_contributions WHERE id=? AND version=1)`,
          ).bind(
            voiceId,
            sourceId,
            user,
            isOwner ? null : grantId,
            attribution,
            limits.agreementVersion,
            r2Key,
            contentType,
            bytes.byteLength,
            contentSha,
            etag,
            now,
            ...(photo ? [] : [durationMs]),
            receiptKey,
            requestHash,
            sourceId,
          ),
          env.DB.prepare(
            "INSERT INTO family_contribution_events(id,contribution_id,actor_user_id,action,revision_id,created_at) SELECT ?,?,?,'submitted',?,? WHERE EXISTS(SELECT 1 FROM family_contribution_sources WHERE id=? AND contribution_id=?)",
          ).bind(receiptKey, sourceId, user, voiceId, now, voiceId, sourceId),
        ]);
        if (!results[0]!.meta.changes) {
          await discard();
          const replay = await prior();
          if (replay) return json({ ...replay, replayed: true });
          if (
            !(await env.DB.prepare(`SELECT 1 AS ok WHERE ${permission}`)
              .bind(...guard)
              .first())
          )
            fail(403, "family_contribution_denied");
          fail(429, "family_contribution_limit");
        }
      } catch (error) {
        if (error instanceof ContributionError) throw error;
        // This attempt's object is unreferenced; a concurrent winner keeps its own key.
        await discard();
        const replay = await prior();
        if (replay) return json({ ...replay, replayed: true });
        throw error;
      }
      return json(result, 201);
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(
        await readBoundedText(request, limits.maximumRequestBytes),
      );
      if (!body || typeof body !== "object" || Array.isArray(body)) fail(400);
    } catch {
      fail(400);
    }
    if (
      (action === "transcript-assembly" && !isOwner) ||
      (action === "transcript" &&
        (current?.author_user_id !== user || !canWrite)) ||
      (action === "assembly" && !isOwner) ||
      (action === "revise" && current?.author_user_id !== user) ||
      (action === "withdraw" && !withdrawing)
    )
      fail(403, "family_contribution_denied");
    if (action === "revise" && current) {
      // Recorded and photographed originals are never revised in place.
      const kind = await env.DB.prepare(
        "SELECT source_kind FROM family_contribution_sources WHERE id=? AND contribution_id=?",
      )
        .bind(current.latest_revision_id, current.id)
        .first<{ source_kind: string }>();
      if (kind?.source_kind === "human_voice")
        fail(409, "family_contribution_voice_fixed");
      if (kind?.source_kind === "human_photo")
        fail(409, "family_contribution_photo_fixed");
    }
    if (
      (!action && contributionId) ||
      (!action && !canWrite) ||
      (action === "revise" && !canWrite)
    )
      fail(403, "family_contribution_denied");
    const key = id(request.headers.get("X-Idempotency-Key")),
      operation = `contribution_${action ?? "submit"}`,
      receiptKey = `contribution_${await sha256Text(`${user}:${operation}:${key}`)}`,
      requestHash = await sha256Text(
        JSON.stringify({ memoryId, contributionId, grantId, body }),
      );
    async function prior() {
      const row = await env.DB.prepare(
        "SELECT request_hash,result_ref FROM operation_receipts WHERE idempotency_key=? AND scope_type='user' AND scope_id=?",
      )
        .bind(receiptKey, user)
        .first<{ request_hash: string; result_ref: string }>();
      if (row && row.request_hash !== requestHash)
        fail(409, "idempotency_conflict");
      return row ? JSON.parse(row.result_ref) : null;
    }
    const old = await prior();
    if (old) return json({ ...old, replayed: true });
    const expected = current ? body.version : 0;
    if (
      !Number.isSafeInteger(expected) ||
      (current && expected !== current.version)
    )
      fail(409, "family_contribution_conflict");
    const now = new Date().toISOString(),
      sourceId =
        current?.id ??
        `family_contribution_${(await sha256Text(receiptKey)).slice(0, 40)}`,
      revisionId = `contribution_revision_${(await sha256Text(`${receiptKey}:revision`)).slice(0, 40)}`,
      nextVersion = Number(expected) + 1;
    let event: string,
      selectedRevision: string | null,
      mutation: D1PreparedStatement,
      revision: D1PreparedStatement | undefined;
    const result = { id: sourceId, version: nextVersion };
    if (!action || action === "revise") {
      if (
        body.agree !== true ||
        body.agreementVersion !== limits.agreementVersion
      )
        fail(400, "family_contribution_consent");
      const attribution = text(body.attribution, limits.attributionCharacters),
        humanText = text(body.text, limits.textCharacters);
      event = current ? "revised" : "submitted";
      selectedRevision = revisionId;
      mutation = current
        ? env.DB.prepare(
            `UPDATE family_contributions SET latest_revision_id=?,author_state='submitted',version=version+1,updated_at=? WHERE id=? AND author_user_id=? AND version=? AND ${permission}`,
          ).bind(revisionId, now, sourceId, user, expected, ...guardParams)
        : env.DB.prepare(
            `INSERT INTO family_contributions(id,memory_story_id,owner_user_id,author_user_id,author_state,latest_revision_id,created_at,updated_at) SELECT ?,?,?,?,'submitted',?,?,? WHERE ${permission} AND (SELECT count(*) FROM family_contributions WHERE memory_story_id=?)<?`,
          ).bind(
            sourceId,
            memoryId,
            memory.owner_user_id,
            user,
            revisionId,
            now,
            now,
            ...guardParams,
            memoryId,
            limits.maximumPerMemory,
          );
      revision = env.DB.prepare(
        "INSERT INTO family_contribution_revisions(id,contribution_id,author_user_id,source_grant_id,previous_revision_id,attribution,human_text,agreement_version,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM operation_receipts WHERE idempotency_key=? AND request_hash=?) AND EXISTS(SELECT 1 FROM family_contributions WHERE id=? AND version=?)",
      ).bind(
        revisionId,
        sourceId,
        user,
        isOwner ? null : grantId,
        current?.latest_revision_id ?? null,
        attribution,
        humanText,
        limits.agreementVersion,
        now,
        receiptKey,
        requestHash,
        sourceId,
        nextVersion,
      );
    } else if (action === "withdraw" && current) {
      event = "withdrawn";
      selectedRevision = current.latest_revision_id;
      mutation = env.DB.prepare(
        "UPDATE family_contributions SET author_state='withdrawn',included_revision_id=NULL,version=version+1,updated_at=? WHERE id=? AND author_user_id=? AND version=?",
      ).bind(now, sourceId, user, expected);
    } else if (action === "transcript" && current) {
      if (
        body.agree !== true ||
        body.agreementVersion !== limits.agreementVersion
      )
        fail(400, "family_contribution_consent");
      const written = text(body.text, limits.textCharacters);
      if (current.author_state !== "submitted")
        fail(409, "family_contribution_conflict");
      const spokenSource = await env.DB.prepare(
        "SELECT 1 AS ok FROM family_contribution_voice_sources WHERE contribution_id=? AND author_user_id=?",
      )
        .bind(sourceId, user)
        .first();
      if (!spokenSource) fail(409, "family_contribution_words_voice_only");
      const previous = await env.DB.prepare(
        "SELECT id FROM family_contribution_voice_transcripts WHERE contribution_id=? ORDER BY rowid DESC LIMIT 1",
      )
        .bind(sourceId)
        .first<{ id: string }>();
      const transcriptId = `contribution_words_${(await sha256Text(`${receiptKey}:words`)).slice(0, 40)}`;
      event = "revised";
      selectedRevision = transcriptId;
      mutation = env.DB.prepare(
        `UPDATE family_contributions SET version=version+1,updated_at=? WHERE id=? AND author_user_id=? AND version=? AND author_state='submitted' AND ${permission}`,
      ).bind(now, sourceId, user, expected, ...guardParams);
      revision = env.DB.prepare(
        "INSERT INTO family_contribution_voice_transcripts(id,contribution_id,author_user_id,previous_transcript_id,written_text,agreement_version,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM operation_receipts WHERE idempotency_key=? AND request_hash=?) AND EXISTS(SELECT 1 FROM family_contributions WHERE id=? AND version=?)",
      ).bind(
        transcriptId,
        sourceId,
        user,
        previous?.id ?? null,
        written,
        limits.agreementVersion,
        now,
        receiptKey,
        requestHash,
        sourceId,
        nextVersion,
      );
    } else if (action === "transcript-assembly" && current) {
      if (body.include !== true && body.include !== false) fail(400);
      const chosen = body.include ? id(body.transcriptId) : null;
      if (
        chosen &&
        !(await env.DB.prepare(
          "SELECT id FROM family_contribution_voice_transcripts WHERE id=? AND contribution_id=?",
        )
          .bind(chosen, sourceId)
          .first())
      )
        fail(404, "family_contribution_not_found");
      // Written words enter family view only alongside an included voice.
      if (
        chosen &&
        (current.author_state !== "submitted" || !current.included_revision_id)
      )
        fail(409, "family_contribution_conflict");
      event = chosen ? "included" : "excluded";
      selectedRevision = chosen;
      mutation = env.DB.prepare(
        `UPDATE family_contributions SET version=version+1,updated_at=? WHERE id=? AND owner_user_id=? AND version=? AND ${permission} AND (? IS NULL OR (author_state='submitted' AND included_revision_id IS NOT NULL))`,
      ).bind(now, sourceId, user, expected, ...guardParams, chosen);
      revision = chosen
        ? env.DB.prepare(
            "INSERT INTO family_contribution_transcript_pins(contribution_id,transcript_id,pinned_by_user_id,pinned_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM operation_receipts WHERE idempotency_key=? AND request_hash=?) ON CONFLICT(contribution_id) DO UPDATE SET transcript_id=excluded.transcript_id,pinned_by_user_id=excluded.pinned_by_user_id,pinned_at=excluded.pinned_at",
          ).bind(sourceId, chosen, user, now, receiptKey, requestHash)
        : env.DB.prepare(
            "DELETE FROM family_contribution_transcript_pins WHERE contribution_id=? AND EXISTS(SELECT 1 FROM operation_receipts WHERE idempotency_key=? AND request_hash=?)",
          ).bind(sourceId, receiptKey, requestHash);
    } else if (action === "assembly" && current) {
      if (body.include !== true && body.include !== false) fail(400);
      const selected = body.include ? id(body.revisionId) : null;
      if (
        selected &&
        !(await env.DB.prepare(
          "SELECT id FROM family_contribution_sources WHERE id=? AND contribution_id=?",
        )
          .bind(selected, sourceId)
          .first())
      )
        fail(404, "family_contribution_not_found");
      if (selected && current.author_state !== "submitted")
        fail(409, "family_contribution_conflict");
      event = selected ? "included" : "excluded";
      selectedRevision = selected;
      mutation = env.DB.prepare(
        `UPDATE family_contributions SET included_revision_id=?,version=version+1,updated_at=? WHERE id=? AND owner_user_id=? AND version=? AND ${permission} AND (? IS NULL OR EXISTS(SELECT 1 FROM family_contribution_sources v JOIN family_contributions c ON c.id=v.contribution_id WHERE v.id=? AND c.id=? AND ${visibleSource}))`,
      ).bind(
        selected,
        now,
        sourceId,
        user,
        expected,
        ...guardParams,
        selected,
        selected,
        sourceId,
      );
    } else fail(405, "method");
    const statements = [
      mutation,
      env.DB.prepare(
        "INSERT INTO operation_receipts(idempotency_key,operation_kind,scope_type,scope_id,request_hash,status,result_ref,correlation_id,created_at,updated_at) SELECT ?,?,'user',?,?,'succeeded',?,?,?,? WHERE changes()=1",
      ).bind(
        receiptKey,
        operation,
        user,
        requestHash,
        JSON.stringify(result),
        receiptKey,
        now,
        now,
      ),
    ];
    if (revision) statements.push(revision);
    statements.push(
      env.DB.prepare(
        "INSERT INTO family_contribution_events(id,contribution_id,actor_user_id,action,revision_id,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM operation_receipts WHERE idempotency_key=? AND request_hash=?) AND EXISTS(SELECT 1 FROM family_contributions WHERE id=? AND version=?)",
      ).bind(
        receiptKey,
        sourceId,
        user,
        event,
        selectedRevision,
        now,
        receiptKey,
        requestHash,
        sourceId,
        nextVersion,
      ),
    );
    try {
      const results = await env.DB.batch(statements);
      if (!results[0]!.meta.changes) {
        const replay = await prior();
        if (replay) return json({ ...replay, replayed: true });
        if (
          !withdrawing &&
          !(await env.DB.prepare(`SELECT 1 AS ok WHERE ${permission}`)
            .bind(...guardParams)
            .first())
        )
          fail(403, "family_contribution_denied");
        fail(
          current ? 409 : 429,
          current
            ? "family_contribution_conflict"
            : "family_contribution_limit",
        );
      }
    } catch (error) {
      const replay = await prior();
      if (replay) return json({ ...replay, replayed: true });
      throw error;
    }
    return json(result, current ? 200 : 201);
  } catch (error) {
    return error instanceof ContributionError
      ? json({ error: { code: error.code } }, error.status)
      : json({ error: { code: "family_contribution_unavailable" } }, 503);
  }
}
