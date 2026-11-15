/**
 * Portable archive export, format version 1.
 *
 * The manifest lists every original file with its SHA-256 so a person, or a
 * future tool, can prove the bytes they hold are the bytes that were preserved.
 * Human testimony, machine output and Muse material are kept in separate,
 * labelled fields. Nothing here contains a share link, token, storage key or
 * account identifier.
 */
export const archiveExportFormat = "memoriesmystory-archive-export";
export const archiveExportVersion = 1;
export const archiveExportLimits = {
  maximumMemories: 500,
  /** One-device export limit; larger archives need a server-built export. */
  maximumTotalBytes: 1500 * 1024 * 1024,
} as const;

export type ArchiveExportFile = {
  /** Path inside the export, also the download address suffix. */
  path: string;
  kind:
    | "asset"
    | "voice-reply"
    | "contribution-voice"
    | "contribution-photo"
    | "session-recording"
    | "session-source";
  id: string;
  role:
    | "original_photograph"
    | "original_voice"
    | "corrected_scan"
    | "cleaned_audio"
    | "voice_reply_to_muse"
    | "family_voice_recollection"
    | "family_added_photograph"
    | "shared_conversation_recording"
    | "shared_conversation_video"
    | "shared_conversation_voice";
  /** True for a source exactly as a person provided it; false for a derivative. */
  original: boolean;
  /** For a derivative, the id of the original it was made from. */
  derivedFromId: string | null;
  contentType: string;
  byteSize: number;
  sha256: string;
  durationMs: number | null;
  /** How a contributing relative chose to be named, when this is their source. */
  attribution: string | null;
  createdAt: string;
};

export type ArchiveExportMemory = {
  id: string;
  title: string | null;
  completedAt: string | null;
  files: ArchiveExportFile[];
  /** Every transcript version. `machine` text was produced by a model, not a person. */
  transcripts: {
    id: string;
    kind: string;
    writtenBy: "machine" | "person";
    current: boolean;
    previousId: string | null;
    locale: string;
    text: string;
    createdAt: string;
  }[];
  /** What the storyteller said about who, where, when and what, with history. */
  storytellerContext: {
    kind: string;
    state: string;
    value: string | null;
    current: boolean;
    createdAt: string;
  }[];
  /** The Muse conversation. `muse` turns are generated questions, never testimony. */
  museConversation: {
    index: number;
    speaker: "muse" | "storyteller";
    text: string;
    createdAt: string;
  }[];
  voiceReplies: {
    fileId: string;
    machineTranscript: string | null;
    storytellerConfirmedText: string | null;
  }[];
  /**
   * Our Living Legacy conversations about this memory's photograph. Each
   * recording carries the consent given before it began; who is speaking is
   * recorded only where a participant identified their own voice.
   */
  sharedConversations?: ArchiveExportConversation[];
  /** Relatives' separately attributed recollections. Withdrawn ones are not exported. */
  familyContributions: {
    id: string;
    attribution: string;
    byOwner: boolean;
    kind: "human_text" | "human_voice" | "human_photo";
    includedForFamily: boolean;
    fileId: string | null;
    /** Every version of a written recollection, oldest first. */
    writtenVersions: { id: string; text: string; createdAt: string }[];
    /** Every version of the words a speaker wrote for their own recording. */
    speakerWrittenWords: {
      id: string;
      text: string;
      includedForFamily: boolean;
      createdAt: string;
    }[];
    createdAt: string;
  }[];
};

export type ArchiveExportConversation = {
  id: string;
  mode: "in_person" | "remote";
  createdAt: string;
  participants: {
    role: "host" | "guest";
    displayName: string | null;
    consent: string;
    consentVersion: string | null;
    accessEnded: boolean;
  }[];
  /** Every consent choice, in order. Later choices do not erase earlier ones. */
  consentHistory: {
    role: "host" | "guest";
    decision: string;
    consentVersion: string;
    scope: string;
    at: string;
  }[];
  recordings: {
    id: string;
    kind: "in_person" | "remote";
    /** "preserved", or "partial_preserved" when only part was captured. */
    state: string;
    interrupted: boolean;
    fileIds: string[];
    /** The accepted consents in force when this recording was authorized. */
    consentAtRecording: {
      role: "host" | "guest" | null;
      consentVersion: string;
      at: string;
    }[];
    /** A participant's own statement of where their voice is; never inferred. */
    selfIdentifiedSpeakers: {
      role: "host" | "guest";
      displayName: string | null;
      fileId: string | null;
      startMs: number | null;
      endMs: number | null;
      note: string;
      at: string;
    }[];
    createdAt: string;
  }[];
};

export type ArchiveExportManifest = {
  format: typeof archiveExportFormat;
  formatVersion: typeof archiveExportVersion;
  generatedAt: string;
  /** False whenever anything the owner holds is not in this export. */
  complete: boolean;
  /** Plain statements of what is not included, so a partial export is never mistaken for a whole one. */
  notIncluded: { code: string; count: number | null }[];
  memories: ArchiveExportMemory[];
  chapters: {
    id: string;
    title: string;
    description: string;
    memoryIds: string[];
  }[];
  people: { id: string; kind: string; document: unknown }[];
};

/** Filled in on the device after each file is downloaded and re-hashed. */
export type ArchiveExportVerification = {
  verifiedAt: string;
  allFilesVerified: boolean;
  files: { path: string; sha256: string; verified: boolean }[];
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * A ZIP archive with stored (uncompressed) entries, so every original is
 * byte-identical inside it. Paths are UTF-8. Limited to the classic ZIP sizes
 * (under 4 GiB and 65,535 entries); callers enforce a smaller total.
 */
export function buildStoredZip(
  entries: readonly { path: string; bytes: Uint8Array }[],
): Uint8Array[] {
  if (entries.length > 65535) throw new Error("archive_export_too_many_files");
  const encoder = new TextEncoder(),
    parts: Uint8Array[] = [],
    central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.path),
      crc = crc32(entry.bytes),
      size = entry.bytes.byteLength;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, 0, true);
    local.setUint16(12, 0x21, true); // 1980-01-01, a fixed date for reproducible archives
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.byteLength, true);
    local.setUint16(28, 0, true);
    const header = new DataView(new ArrayBuffer(46));
    header.setUint32(0, 0x02014b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 20, true);
    header.setUint16(8, 0x0800, true);
    header.setUint16(10, 0, true);
    header.setUint16(12, 0, true);
    header.setUint16(14, 0x21, true);
    header.setUint32(16, crc, true);
    header.setUint32(20, size, true);
    header.setUint32(24, size, true);
    header.setUint16(28, name.byteLength, true);
    header.setUint32(42, offset, true);
    parts.push(new Uint8Array(local.buffer), name, entry.bytes);
    central.push(new Uint8Array(header.buffer), name);
    offset += 30 + name.byteLength + size;
    if (offset > 0xffffffff) throw new Error("archive_export_too_large");
  }
  const centralSize = central.reduce((sum, part) => sum + part.byteLength, 0),
    end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return [...parts, ...central, new Uint8Array(end.buffer)];
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * A plain page a person can open from the unpacked export without any app.
 * `label` supplies interface wording; people's own words are escaped, never translated.
 */
export function renderExportIndex(
  manifest: ArchiveExportManifest,
  verification: ArchiveExportVerification,
  label: (key: string, values?: Record<string, string | number>) => string,
  language: string,
): string {
  const text = (key: string, values?: Record<string, string | number>) =>
      escapeHtml(label(key, values)),
    verified = new Map(verification.files.map((file) => [file.path, file.verified]));
  const memories = manifest.memories
    .map((memory) => {
      const files = memory.files
        .map(
          (file) =>
            `<li><a href="${escapeHtml(encodeURI(file.path))}">${text(`export role: ${file.role}`)}</a>${file.attribution ? ` — ${escapeHtml(file.attribution)}` : ""} · ${verified.get(file.path) ? text("Checked: matches the preserved original") : text("Not checked: this file is missing or did not match")}<br><code>SHA-256 ${escapeHtml(file.sha256)}</code></li>`,
        )
        .join("");
      const current = memory.transcripts.find((entry) => entry.current),
        context = memory.storytellerContext
          .filter((entry) => entry.current && entry.value)
          .map(
            (entry) =>
              `<li>${text(`export context: ${entry.kind}`)}${entry.state === "approximate" ? ` (${text("approximately")})` : ""}: ${escapeHtml(entry.value!)}</li>`,
          )
          .join(""),
        contributions = memory.familyContributions
          .map((entry) => {
            const written = entry.writtenVersions.at(-1) ?? entry.speakerWrittenWords.at(-1);
            return `<li><strong>${escapeHtml(entry.attribution)}</strong>${written ? `<blockquote>${escapeHtml(written.text)}</blockquote>` : ""}</li>`;
          })
          .join("");
      return `<section><h2>${memory.title ? escapeHtml(memory.title) : text("Living Memory")}</h2><ul>${files}</ul>${current ? `<h3>${text(current.writtenBy === "machine" ? "Words from the recording (machine transcript, not reviewed by a person)" : "Words from the recording (reviewed by the storyteller)")}</h3><blockquote>${escapeHtml(current.text)}</blockquote>` : ""}${context ? `<h3>${text("What the storyteller said")}</h3><ul>${context}</ul>` : ""}${contributions ? `<h3>${text("Family recollections")}</h3><ul>${contributions}</ul>` : ""}</section>`;
    })
    .join("");
  const missing = manifest.notIncluded
    .map(
      (item) =>
        `<li>${text(`export not included: ${item.code}`)}${item.count === null ? "" : ` (${item.count})`}</li>`,
    )
    .join("");
  return `<!doctype html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${text("Your family archive export")}</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:auto;padding:24px;line-height:1.5}code{font-size:.8rem;word-break:break-all}blockquote{white-space:pre-wrap;margin:8px 0;padding-left:12px;border-left:3px solid #999}</style></head><body><h1>${text("Your family archive export")}</h1><p>${text("Exported {date}", { date: manifest.generatedAt })}</p><p><strong>${text(manifest.complete && verification.allFilesVerified ? "Every file listed here was checked against the preserved original." : "This export is not complete. Read what is missing below.")}</strong></p>${missing ? `<h2>${text("Not included in this export")}</h2><ul>${missing}</ul>` : ""}<p>${text("The file manifest.json lists every file with its SHA-256 so the originals can be checked again at any time.")}</p>${memories}</body></html>`;
}
