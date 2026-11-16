import { authenticateAppSession, type AuthSessionEnv } from "./auth-session";
import {
  archiveExportFormat,
  archiveExportLimits as limits,
  archiveExportVersion,
  type ArchiveExportConversation,
  type ArchiveExportFile,
  type ArchiveExportManifest,
  type ArchiveExportMemory,
} from "../app/domain/archive-export";

export type ArchiveExportEnv = AuthSessionEnv & { MEDIA_BUCKET: R2Bucket };

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers });
const idPattern = /^[A-Za-z0-9_-]{8,180}$/;
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "video/mp4": "mp4",
  "video/webm": "webm",
};
const assetRoles: Record<string, [ArchiveExportFile["role"], boolean]> = {
  original_photo: ["original_photograph", true],
  original_audio: ["original_voice", true],
  enhanced_photo: ["corrected_scan", false],
  cleaned_audio: ["cleaned_audio", false],
};

// Each kind resolves to one durable object owned (through its memory) by ?2.
export const fileSources: Record<ArchiveExportFile["kind"], string> = {
  asset:
    "SELECT a.r2_key,a.content_type,a.byte_size,a.sha256 FROM media_assets a JOIN memory_stories m ON m.id=a.memory_story_id WHERE a.id=?1 AND m.owner_user_id=?2 AND m.status='complete' AND a.durability_status='durable'",
  "voice-reply":
    "SELECT a.r2_key,a.content_type,a.byte_size,a.sha256 FROM muse_voice_reply_assets a JOIN memory_stories m ON m.id=a.memory_story_id WHERE a.id=?1 AND m.owner_user_id=?2 AND m.status='complete' AND a.durability_status='durable'",
  "contribution-voice":
    "SELECT s.r2_key,s.content_type,s.byte_size,s.sha256 FROM family_contribution_voice_sources s JOIN family_contributions c ON c.id=s.contribution_id JOIN memory_stories m ON m.id=c.memory_story_id WHERE s.id=?1 AND m.owner_user_id=?2 AND m.status='complete' AND c.author_state='submitted'",
  "contribution-photo":
    "SELECT s.r2_key,s.content_type,s.byte_size,s.sha256 FROM family_contribution_photo_sources s JOIN family_contributions c ON c.id=s.contribution_id JOIN memory_stories m ON m.id=c.memory_story_id WHERE s.id=?1 AND m.owner_user_id=?2 AND m.status='complete' AND c.author_state='submitted'",
  "session-recording":
    "SELECT x.r2_key,x.content_type,x.byte_size,x.sha256 FROM legacy_recording_media x JOIN legacy_recordings r ON r.id=x.recording_id JOIN legacy_sessions s ON s.id=r.session_id JOIN memory_stories m ON m.id=s.memory_story_id WHERE x.recording_id=?1 AND m.owner_user_id=?2 AND s.owner_user_id=?2 AND m.status='complete' AND x.durability_status='durable' AND s.deletion_requested_at IS NULL",
  "session-source":
    "SELECT x.r2_key,x.content_type,x.byte_size,x.sha256 FROM legacy_remote_sources x JOIN legacy_remote_recordings r ON r.id=x.recording_id JOIN legacy_sessions s ON s.id=r.session_id JOIN memory_stories m ON m.id=s.memory_story_id WHERE x.id=?1 AND m.owner_user_id=?2 AND s.owner_user_id=?2 AND m.status='complete' AND x.durability_status='durable' AND r.phase IN ('preserved','partial_preserved') AND s.deletion_requested_at IS NULL",
};

export async function buildArchiveManifest(env: ArchiveExportEnv, owner: string) {
  const all = <T>(sql: string, ...values: unknown[]) =>
    env.DB.prepare(sql)
      .bind(...values)
      .all<T>()
      .then((result) => result.results);
  const owned =
    "IN (SELECT id FROM memory_stories WHERE owner_user_id=?1 AND status='complete')";
  const stories = await all<{
    id: string;
    title: string | null;
    completed_at: string | null;
    current_transcript_revision_id: string | null;
  }>(
    "SELECT m.id,l.title,m.completed_at,m.current_transcript_revision_id FROM memory_stories m LEFT JOIN family_memory_labels l ON l.memory_story_id=m.id WHERE m.owner_user_id=?1 AND m.status='complete' ORDER BY m.completed_at,m.id LIMIT ?2",
    owner,
    limits.maximumMemories + 1,
  );
  const truncated = stories.length > limits.maximumMemories,
    memories = new Map<string, ArchiveExportMemory>();
  for (const story of stories.slice(0, limits.maximumMemories))
    memories.set(story.id, {
      id: story.id,
      title: story.title,
      completedAt: story.completed_at,
      files: [],
      transcripts: [],
      storytellerContext: [],
      museConversation: [],
      voiceReplies: [],
      sharedConversations: [],
      familyContributions: [],
    });
  const currentTranscript = new Map(
    stories.map((story) => [story.id, story.current_transcript_revision_id]),
  );
  const file = (
    memoryId: string,
    kind: ArchiveExportFile["kind"],
    role: ArchiveExportFile["role"],
    row: {
      id: string;
      content_type: string;
      byte_size: number;
      sha256: string;
      duration_ms?: number | null;
      created_at: string;
    },
    extra: Partial<ArchiveExportFile> = {},
  ) => {
    const memory = memories.get(memoryId);
    if (!memory) return;
    memory.files.push({
      path: `memories/${memoryId}/${role}/${row.id}.${extensions[row.content_type] ?? "bin"}`,
      kind,
      id: row.id,
      role,
      original: true,
      derivedFromId: null,
      contentType: row.content_type,
      byteSize: row.byte_size,
      sha256: row.sha256,
      durationMs: row.duration_ms ?? null,
      attribution: null,
      createdAt: row.created_at,
      ...extra,
    });
  };

  for (const row of await all<{
    id: string;
    memory_story_id: string;
    role: string;
    source_asset_id: string | null;
    content_type: string;
    byte_size: number;
    sha256: string;
    duration_ms: number | null;
    created_at: string;
  }>(
    `SELECT id,memory_story_id,role,source_asset_id,content_type,byte_size,sha256,duration_ms,created_at FROM media_assets WHERE durability_status='durable' AND memory_story_id ${owned} ORDER BY created_at,id`,
    owner,
  )) {
    const [role, original] = assetRoles[row.role] ?? ["original_photograph", true];
    file(row.memory_story_id, "asset", role, row, {
      original,
      derivedFromId: row.source_asset_id,
    });
  }
  for (const row of await all<{
    id: string;
    memory_story_id: string;
    content_type: string;
    byte_size: number;
    sha256: string;
    duration_ms: number;
    created_at: string;
    transcript_text: string | null;
    storyteller_text: string | null;
  }>(
    `SELECT id,memory_story_id,content_type,byte_size,sha256,duration_ms,created_at,transcript_text,storyteller_text FROM muse_voice_reply_assets WHERE durability_status='durable' AND memory_story_id ${owned} ORDER BY created_at,id`,
    owner,
  )) {
    file(row.memory_story_id, "voice-reply", "voice_reply_to_muse", row);
    memories.get(row.memory_story_id)?.voiceReplies.push({
      fileId: row.id,
      machineTranscript: row.transcript_text,
      storytellerConfirmedText: row.storyteller_text,
    });
  }
  for (const row of await all<{
    id: string;
    memory_story_id: string;
    revision_kind: string;
    created_by_type: string;
    parent_revision_id: string | null;
    locale: string;
    text: string;
    created_at: string;
  }>(
    `SELECT id,memory_story_id,revision_kind,created_by_type,parent_revision_id,locale,text,created_at FROM transcript_revisions WHERE memory_story_id ${owned} ORDER BY created_at,id`,
    owner,
  ))
    memories.get(row.memory_story_id)?.transcripts.push({
      id: row.id,
      kind: row.revision_kind,
      writtenBy: row.created_by_type === "machine" ? "machine" : "person",
      current: currentTranscript.get(row.memory_story_id) === row.id,
      previousId: row.parent_revision_id,
      locale: row.locale,
      text: row.text,
      createdAt: row.created_at,
    });
  const seenContext = new Set<string>();
  for (const row of await all<{
    memory_story_id: string;
    kind: string;
    value: string | null;
    context_state: string;
    created_at: string;
  }>(
    `SELECT memory_story_id,kind,value,context_state,created_at FROM living_memory_context_entries WHERE memory_story_id ${owned} ORDER BY created_at DESC,rowid DESC`,
    owner,
  )) {
    const key = `${row.memory_story_id}:${row.kind}`;
    memories.get(row.memory_story_id)?.storytellerContext.unshift({
      kind: row.kind,
      state: row.context_state,
      value: row.value,
      current: !seenContext.has(key),
      createdAt: row.created_at,
    });
    seenContext.add(key);
  }
  for (const row of await all<{
    memory_story_id: string;
    turn_index: number;
    speaker: "muse" | "storyteller";
    content: string;
    created_at: string;
  }>(
    `SELECT memory_story_id,turn_index,speaker,content,created_at FROM muse_conversation_turns WHERE memory_story_id ${owned} ORDER BY memory_story_id,turn_index`,
    owner,
  ))
    memories.get(row.memory_story_id)?.museConversation.push({
      index: row.turn_index,
      speaker: row.speaker,
      text: row.content,
      createdAt: row.created_at,
    });

  // Family contributions: submitted ones only. A withdrawn recollection is not
  // exported; it is counted so the export never looks more complete than it is.
  const contributions = await all<{
    id: string;
    memory_story_id: string;
    author_user_id: string;
    author_state: string;
    included_revision_id: string | null;
    created_at: string;
  }>(
    `SELECT id,memory_story_id,author_user_id,author_state,included_revision_id,created_at FROM family_contributions WHERE owner_user_id=?1 AND memory_story_id ${owned} ORDER BY created_at,id`,
    owner,
  );
  const submitted = new Map(
    contributions
      .filter((row) => row.author_state === "submitted")
      .map((row) => [
        row.id,
        {
          row,
          entry: {
            id: row.id,
            attribution: "",
            byOwner: row.author_user_id === owner,
            kind: "human_text" as "human_text" | "human_voice" | "human_photo",
            includedForFamily: Boolean(row.included_revision_id),
            fileId: null as string | null,
            writtenVersions: [] as { id: string; text: string; createdAt: string }[],
            speakerWrittenWords: [] as {
              id: string;
              text: string;
              includedForFamily: boolean;
              createdAt: string;
            }[],
            createdAt: row.created_at,
          },
        },
      ]),
  );
  for (const row of await all<{
    id: string;
    contribution_id: string;
    attribution: string;
    human_text: string;
    created_at: string;
  }>(
    "SELECT v.id,v.contribution_id,v.attribution,v.human_text,v.created_at FROM family_contribution_revisions v JOIN family_contributions c ON c.id=v.contribution_id WHERE c.owner_user_id=?1 ORDER BY v.rowid",
    owner,
  )) {
    const found = submitted.get(row.contribution_id);
    if (!found) continue;
    found.entry.attribution = row.attribution;
    found.entry.writtenVersions.push({
      id: row.id,
      text: row.human_text,
      createdAt: row.created_at,
    });
  }
  for (const kind of ["voice", "photo"] as const)
    for (const row of await all<{
      id: string;
      contribution_id: string;
      attribution: string;
      content_type: string;
      byte_size: number;
      sha256: string;
      duration_ms: number | null;
      created_at: string;
    }>(
      `SELECT s.id,s.contribution_id,s.attribution,s.content_type,s.byte_size,s.sha256,${kind === "voice" ? "s.duration_ms" : "NULL AS duration_ms"},s.created_at FROM family_contribution_${kind}_sources s JOIN family_contributions c ON c.id=s.contribution_id WHERE c.owner_user_id=?1 ORDER BY s.rowid`,
      owner,
    )) {
      const found = submitted.get(row.contribution_id);
      if (!found) continue;
      found.entry.attribution = row.attribution;
      found.entry.kind = kind === "voice" ? "human_voice" : "human_photo";
      found.entry.fileId = row.id;
      file(
        found.row.memory_story_id,
        `contribution-${kind}`,
        kind === "voice" ? "family_voice_recollection" : "family_added_photograph",
        row,
        { attribution: row.attribution },
      );
    }
  for (const row of await all<{
    id: string;
    contribution_id: string;
    written_text: string;
    created_at: string;
    pinned: string | null;
  }>(
    "SELECT t.id,t.contribution_id,t.written_text,t.created_at,p.transcript_id AS pinned FROM family_contribution_voice_transcripts t JOIN family_contributions c ON c.id=t.contribution_id LEFT JOIN family_contribution_transcript_pins p ON p.contribution_id=t.contribution_id WHERE c.owner_user_id=?1 ORDER BY t.rowid",
    owner,
  ))
    submitted.get(row.contribution_id)?.entry.speakerWrittenWords.push({
      id: row.id,
      text: row.written_text,
      includedForFamily: row.pinned === row.id,
      createdAt: row.created_at,
    });
  for (const { row, entry } of submitted.values())
    memories.get(row.memory_story_id)?.familyContributions.push(entry);

  // Our Living Legacy conversations: consent first, then the preserved sources.
  const sessionRows = await all<{
    id: string;
    memory_story_id: string;
    mode: "in_person" | "remote";
    created_at: string;
  }>(
    `SELECT id,memory_story_id,mode,created_at FROM legacy_sessions WHERE owner_user_id=?1 AND deletion_requested_at IS NULL AND memory_story_id ${owned} ORDER BY created_at,id`,
    owner,
  );
  const conversations = new Map<string, ArchiveExportConversation>(),
    conversationMemory = new Map<string, string>(),
    people = new Map<
      string,
      { role: "host" | "guest"; displayName: string | null }
    >();
  for (const row of sessionRows) {
    const conversation: ArchiveExportConversation = {
      id: row.id,
      mode: row.mode,
      createdAt: row.created_at,
      participants: [],
      consentHistory: [],
      recordings: [],
    };
    conversations.set(row.id, conversation);
    conversationMemory.set(row.id, row.memory_story_id);
    memories.get(row.memory_story_id)?.sharedConversations?.push(conversation);
  }
  const inSessions =
    "IN (SELECT id FROM legacy_sessions WHERE owner_user_id=?1 AND deletion_requested_at IS NULL)";
  for (const row of await all<{
    id: string;
    session_id: string;
    role: "host" | "guest";
    display_name: string | null;
    consent: string;
    consent_version: string | null;
    revoked_at: string | null;
  }>(
    `SELECT id,session_id,role,display_name,consent,consent_version,revoked_at FROM legacy_participants WHERE session_id ${inSessions} ORDER BY created_at,id`,
    owner,
  )) {
    people.set(row.id, { role: row.role, displayName: row.display_name });
    conversations.get(row.session_id)?.participants.push({
      role: row.role,
      displayName: row.display_name,
      consent: row.consent,
      consentVersion: row.consent_version,
      accessEnded: Boolean(row.revoked_at),
    });
  }
  for (const row of await all<{
    session_id: string;
    participant_id: string;
    decision: string;
    consent_version: string;
    scope: string;
    created_at: string;
  }>(
    `SELECT session_id,participant_id,decision,consent_version,scope,created_at FROM legacy_consent_events WHERE session_id ${inSessions} ORDER BY rowid`,
    owner,
  ))
    conversations.get(row.session_id)?.consentHistory.push({
      role: people.get(row.participant_id)?.role ?? "guest",
      decision: row.decision,
      consentVersion: row.consent_version,
      scope: row.scope,
      at: row.created_at,
    });
  const snapshot = (value: string) => {
    let events: unknown;
    try {
      events = JSON.parse(value);
    } catch {
      events = [];
    }
    return (Array.isArray(events) ? events : []).map(
      (event: { participant_id?: string; consent_version?: string; created_at?: string }) => ({
        role: people.get(String(event.participant_id))?.role ?? null,
        consentVersion: String(event.consent_version ?? ""),
        at: String(event.created_at ?? ""),
      }),
    );
  };
  type Recording = ArchiveExportConversation["recordings"][number];
  const recordings = new Map<string, Recording>();
  let unpreserved = 0;
  for (const row of await all<{
    id: string;
    session_id: string;
    consent_snapshot_json: string;
    created_at: string;
    content_type: string | null;
    byte_size: number | null;
    sha256: string | null;
    duration_ms: number | null;
    interrupted: number | null;
    durability_status: string | null;
  }>(
    `SELECT r.id,r.session_id,r.consent_snapshot_json,r.created_at,x.content_type,x.byte_size,x.sha256,x.duration_ms,x.interrupted,x.durability_status FROM legacy_recordings r LEFT JOIN legacy_recording_media x ON x.recording_id=r.id WHERE r.session_id ${inSessions} ORDER BY r.created_at,r.id`,
    owner,
  )) {
    if (row.durability_status !== "durable" || !row.sha256) {
      unpreserved++;
      continue;
    }
    const recording: Recording = {
      id: row.id,
      kind: "in_person",
      state: "preserved",
      interrupted: row.interrupted === 1,
      fileIds: [row.id],
      consentAtRecording: snapshot(row.consent_snapshot_json),
      selfIdentifiedSpeakers: [],
      createdAt: row.created_at,
    };
    recordings.set(row.id, recording);
    conversations.get(row.session_id)?.recordings.push(recording);
    file(
      conversationMemory.get(row.session_id)!,
      "session-recording",
      "shared_conversation_recording",
      {
        id: row.id,
        content_type: row.content_type!,
        byte_size: row.byte_size!,
        sha256: row.sha256,
        duration_ms: row.duration_ms,
        created_at: row.created_at,
      },
    );
  }
  for (const row of await all<{
    recording_id: string;
    participant_id: string;
    start_ms: number;
    end_ms: number;
    note: string;
    created_at: string;
  }>(
    `SELECT c.recording_id,c.participant_id,c.start_ms,c.end_ms,c.note,c.created_at FROM legacy_recording_claims c JOIN legacy_recordings r ON r.id=c.recording_id WHERE r.session_id ${inSessions} ORDER BY c.rowid`,
    owner,
  ))
    recordings.get(row.recording_id)?.selfIdentifiedSpeakers.push({
      role: people.get(row.participant_id)?.role ?? "guest",
      displayName: people.get(row.participant_id)?.displayName ?? null,
      fileId: row.recording_id,
      startMs: row.start_ms,
      endMs: row.end_ms,
      note: row.note,
      at: row.created_at,
    });
  for (const row of await all<{
    id: string;
    session_id: string;
    consent_snapshot_json: string;
    phase: string;
    created_at: string;
  }>(
    `SELECT id,session_id,consent_snapshot_json,phase,created_at FROM legacy_remote_recordings WHERE session_id ${inSessions} ORDER BY created_at,id`,
    owner,
  )) {
    if (row.phase !== "preserved" && row.phase !== "partial_preserved") {
      unpreserved++;
      continue;
    }
    const recording: Recording = {
      id: row.id,
      kind: "remote",
      state: row.phase,
      interrupted: row.phase === "partial_preserved",
      fileIds: [],
      consentAtRecording: snapshot(row.consent_snapshot_json),
      selfIdentifiedSpeakers: [],
      createdAt: row.created_at,
    };
    recordings.set(row.id, recording);
    conversations.get(row.session_id)?.recordings.push(recording);
  }
  for (const row of await all<{
    id: string;
    recording_id: string;
    session_id: string;
    participant_id: string | null;
    kind: string;
    content_type: string;
    byte_size: number | null;
    sha256: string | null;
    durability_status: string;
    created_at: string;
  }>(
    `SELECT x.id,x.recording_id,r.session_id,x.participant_id,x.kind,x.content_type,x.byte_size,x.sha256,x.durability_status,x.created_at FROM legacy_remote_sources x JOIN legacy_remote_recordings r ON r.id=x.recording_id WHERE r.session_id ${inSessions} ORDER BY x.created_at,x.id`,
    owner,
  )) {
    const recording = recordings.get(row.recording_id);
    if (!recording) continue;
    if (row.durability_status !== "durable" || !row.sha256 || !row.byte_size) {
      unpreserved++;
      continue;
    }
    recording.fileIds.push(row.id);
    file(
      conversationMemory.get(row.session_id)!,
      "session-source",
      row.kind === "composite_video"
        ? "shared_conversation_video"
        : "shared_conversation_voice",
      {
        id: row.id,
        content_type: row.content_type,
        byte_size: row.byte_size,
        sha256: row.sha256,
        created_at: row.created_at,
      },
      {
        attribution: row.participant_id
          ? (people.get(row.participant_id)?.displayName ?? null)
          : null,
      },
    );
  }
  for (const row of await all<{
    source_id: string;
    recording_id: string;
    participant_id: string;
    note: string;
    created_at: string;
  }>(
    `SELECT c.source_id,x.recording_id,c.participant_id,c.note,c.created_at FROM legacy_remote_source_claims c JOIN legacy_remote_sources x ON x.id=c.source_id JOIN legacy_remote_recordings r ON r.id=x.recording_id WHERE r.session_id ${inSessions} ORDER BY c.rowid`,
    owner,
  ))
    recordings.get(row.recording_id)?.selfIdentifiedSpeakers.push({
      role: people.get(row.participant_id)?.role ?? "guest",
      displayName: people.get(row.participant_id)?.displayName ?? null,
      fileId: row.source_id,
      startMs: null,
      endMs: null,
      note: row.note,
      at: row.created_at,
    });

  const albums = await all<{ id: string; title: string; description: string }>(
    "SELECT a.id,a.title,a.description FROM family_archives a WHERE a.owner_user_id=?1 ORDER BY a.created_at,a.id",
    owner,
  );
  const chapters = await all<{
    id: string;
    album_id: string;
    title: string;
    description: string;
    members: string | null;
  }>(
    "SELECT c.id,c.archive_id AS album_id,c.title,c.description,(SELECT json_group_array(memory_story_id) FROM (SELECT cm.memory_story_id FROM family_chapter_memories cm WHERE cm.chapter_id=c.id ORDER BY cm.position)) AS members FROM family_chapters c JOIN family_archives a ON a.id=c.archive_id WHERE a.owner_user_id=?1 ORDER BY a.id,c.position,c.id",
    owner,
  );
  const peopleRecords = await all<{ id: string; kind: string; document_json: string }>(
    "SELECT r.id,r.kind,r.document_json FROM family_people_records r JOIN family_archives a ON a.id=r.archive_id WHERE a.owner_user_id=?1 AND r.active=1 ORDER BY r.id",
    owner,
  );
  const count = async (sql: string) =>
    (await env.DB.prepare(sql).bind(owner).first<{ n: number }>())?.n ?? 0;
  const withdrawn = contributions.filter(
      (row) => row.author_state !== "submitted",
    ).length,
    drafts = await count(
      "SELECT count(*) AS n FROM memory_stories WHERE owner_user_id=?1 AND status<>'complete'",
    );
  // State plainly what this format version does not carry.
  const notIncluded: ArchiveExportManifest["notIncluded"] = [];
  if (truncated) notIncluded.push({ code: "more_memories_than_one_export", count: null });
  if (unpreserved) notIncluded.push({ code: "shared_recordings_not_preserved", count: unpreserved });
  if (withdrawn) notIncluded.push({ code: "recollections_withdrawn_by_their_author", count: withdrawn });
  if (drafts) notIncluded.push({ code: "unfinished_memories", count: drafts });
  const result: ArchiveExportManifest = {
    format: archiveExportFormat,
    formatVersion: archiveExportVersion,
    generatedAt: new Date().toISOString(),
    complete: notIncluded.length === 0,
    notIncluded,
    memories: [...memories.values()],
    albums: albums.map((album) => ({
      id: album.id,
      title: album.title,
      description: album.description,
      chapterIds: chapters
        .filter((chapter) => chapter.album_id === album.id)
        .map((chapter) => chapter.id),
    })),
    chapters: chapters.map((chapter) => ({
      id: chapter.id,
      albumId: chapter.album_id,
      title: chapter.title,
      description: chapter.description,
      memoryIds: (JSON.parse(chapter.members ?? "[]") as string[]).filter((id) =>
        memories.has(id),
      ),
    })),
    people: peopleRecords.map((person) => ({
      id: person.id,
      kind: person.kind,
      document: JSON.parse(person.document_json),
    })),
  };
  return result;
}

/** Owner-only: a manifest of everything exportable, and each file with its hash. */
export async function handleArchiveExportRoute(
  request: Request,
  env: ArchiveExportEnv,
): Promise<Response | null> {
  const url = new URL(request.url),
    match = url.pathname.match(
      /^\/resources\/archive-export\/(manifest|file\/(asset|voice-reply|contribution-voice|contribution-photo|session-recording|session-source)\/([^/]+))$/,
    );
  if (!match) return null;
  try {
    if (request.method !== "GET") return json({ error: { code: "method" } }, 405);
    const session = await authenticateAppSession(request, env);
    if (!session) return json({ error: { code: "session_required" } }, 401);
    if (match[1] === "manifest")
      return json(await buildArchiveManifest(env, session.userId));
    const kind = match[2] as ArchiveExportFile["kind"],
      id = match[3]!;
    if (!idPattern.test(id))
      return json({ error: { code: "archive_export_not_found" } }, 404);
    const source = await env.DB.prepare(fileSources[kind])
      .bind(id, session.userId)
      .first<{
        r2_key: string;
        content_type: string;
        byte_size: number;
        sha256: string;
      }>();
    if (!source) return json({ error: { code: "archive_export_not_found" } }, 404);
    const object = await env.MEDIA_BUCKET.get(source.r2_key);
    if (!object) return json({ error: { code: "archive_export_unavailable" } }, 503);
    return new Response(object.body, {
      headers: {
        ...headers,
        "Content-Type": source.content_type,
        "Content-Length": String(source.byte_size),
        "X-Content-SHA256": source.sha256,
      },
    });
  } catch {
    return json({ error: { code: "archive_export_unavailable" } }, 503);
  }
}
