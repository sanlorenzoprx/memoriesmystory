import { phase1Config } from "../config/phase-1";
import type { ViewingImagesBinding } from "./private-media";
import { createMuseTextProvider, type MuseProviderEnv } from "./providers/muse-provider";

/**
 * Muse looks at the photograph (Talk with Muse M3, decision 2026-11-16).
 *
 * Once per Living Memory, Muse describes only what can be seen: people by
 * appearance and position, setting, objects, light. Never a name, date,
 * year, place name, relationship, event or feeling. The note is stored as
 * Muse-generated material and is used only to shape Muse's questions, so
 * Muse can ask "Who is the woman in the white dress?" but never says who she is.
 */
export type MusePhotoEnv = MuseProviderEnv & {
  readonly DB: D1Database;
  readonly MEDIA_BUCKET?: R2Bucket;
  readonly IMAGES?: ViewingImagesBinding;
};

const inlineTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const convertLimit = 20 * 1024 * 1024;

export function photoNoteSystemPrompt(locale: string): string {
  const language = locale.toLowerCase().startsWith("es") ? "Spanish" : "English";
  return (
    "You help a person remember the story behind their own family photograph. Describe only what can be seen: " +
    "people by appearance, position and clothing; the setting; objects; light and weather. Never give or guess a name, age, " +
    "date, year, place name, relationship, occasion, event, feeling or anything that cannot be seen. One to three short sentences. " +
    `Output only the description, in ${language}.`
  );
}

/**
 * A note is kept only if it stays within what can be seen: no digits (dates,
 * ages, years) and nothing longer than the table allows. Anything else is
 * discarded and Muse asks from the storyteller's words alone.
 */
export function acceptablePhotoNote(note: string): string | null {
  const text = note.replace(/\s+/g, " ").trim();
  if (!text || text.length > 600 || /\d/.test(text)) return null;
  return text;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

/** The original's bytes, or a JPEG copy when the original is HEIC or large. Null when neither fits. */
async function photoForMuse(
  env: MusePhotoEnv,
  photo: { r2_key: string; content_type: string; byte_size: number },
): Promise<{ mimeType: string; base64: string } | null> {
  if (!env.MEDIA_BUCKET) return null;
  const limit = phase1Config.ai.musePhotoInlineLimitBytes;
  if (inlineTypes.has(photo.content_type) && photo.byte_size <= limit) {
    const object = await env.MEDIA_BUCKET.get(photo.r2_key);
    if (!object) return null;
    return { mimeType: photo.content_type, base64: toBase64(new Uint8Array(await object.arrayBuffer())) };
  }
  if (!env.IMAGES || photo.byte_size > convertLimit) return null;
  const object = await env.MEDIA_BUCKET.get(photo.r2_key);
  if (!object) return null;
  const converted = (await env.IMAGES.input(object.body).output({ format: "image/jpeg", quality: 80 })).response();
  if (!converted.ok) return null;
  const bytes = new Uint8Array(await converted.arrayBuffer());
  return bytes.length <= limit ? { mimeType: "image/jpeg", base64: toBase64(bytes) } : null;
}

export async function readPhotoNote(env: { DB: D1Database }, livingMemoryId: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT content FROM muse_photo_notes WHERE memory_story_id = ?")
    .bind(livingMemoryId)
    .first<{ content: string }>();
  return row?.content ?? null;
}

/**
 * The stored note, or a new one made now. Returns null, and stores nothing,
 * when the photograph cannot be read, no model can look at it, or the
 * description strays beyond what can be seen. Never throws.
 */
export async function ensurePhotoNote(env: MusePhotoEnv, livingMemoryId: string, locale: string): Promise<string | null> {
  try {
    const existing = await readPhotoNote(env, livingMemoryId);
    if (existing) return existing;
    const photo = await env.DB.prepare(
      `SELECT a.id, a.r2_key, a.content_type, a.byte_size
       FROM memory_stories m
       JOIN media_assets a ON a.id = m.primary_photo_asset_id AND a.memory_story_id = m.id
       WHERE m.id = ? AND a.role = 'original_photo' AND a.durability_status = 'durable'`,
    )
      .bind(livingMemoryId)
      .first<{ id: string; r2_key: string; content_type: string; byte_size: number }>();
    if (!photo) return null;
    const image = await photoForMuse(env, photo);
    if (!image) return null;
    const note = acceptablePhotoNote(
      await createMuseTextProvider(env).generate({
        system: photoNoteSystemPrompt(locale),
        user: locale.toLowerCase().startsWith("es") ? "Describe lo que se ve." : "Describe what can be seen.",
        image,
        maxTokens: 160,
        temperature: 0.2,
      }),
    );
    if (!note) return null;
    await env.DB.prepare(
      `INSERT OR IGNORE INTO muse_photo_notes
         (memory_story_id, photo_asset_id, content, model_config_version, prompt_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(livingMemoryId, photo.id, note, phase1Config.ai.modelConfigVersion, phase1Config.ai.musePhotoNotePromptVersion, new Date().toISOString())
      .run();
    return (await readPhotoNote(env, livingMemoryId)) ?? note;
  } catch {
    // Muse still listens and asks from the storyteller's words.
    return null;
  }
}
