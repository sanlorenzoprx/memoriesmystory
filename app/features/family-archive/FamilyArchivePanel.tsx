import { FamilyInvitationsPanel } from "./FamilyInvitationsPanel";
import { PeoplePanel } from "./PeoplePanel";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { phase1Config } from "../../../config/phase-1";
import type {
  FamilyArchiveIndex,
  FamilyChapter,
  FamilyMemory,
} from "../../domain/family-archive";
import {
  familyRequest,
  loadChapter,
  loadFamilyArchive,
  loadFamilyMemory,
} from "../../services/family-archive";
import { t, notice, useLocale } from "../../localization/language";
// Name ideas only. Nothing is created until the person chooses and saves.
const albumIdeas = [
  "Family holidays",
  "Vacations",
  "About one person",
  "A family home",
  "A family tradition",
] as const;
const limits = phase1Config.familyArchive;
const newKey = () => `family_request_${crypto.randomUUID()}`;
export function FamilyArchivePanel() {
  useLocale();
  const [view, setView] = useState<FamilyArchiveIndex | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [editing, setEditing] = useState<string | null>(null);
  const key = useRef<string | null>(null),
    archiveKey = useRef(newKey()),
    archiveTitle = useRef(t("My family album")),
    dirtyRef = useRef(false),
    chapterDirtyRef = useRef(false),
    peopleDirtyRef = useRef(false),
    inviteDirtyRef = useRef(false);
  const setCurrentDirty = useCallback((value: boolean) => {
    chapterDirtyRef.current = value;
    dirtyRef.current =
      value || peopleDirtyRef.current || inviteDirtyRef.current;
  }, []);
  const setPeopleDirty = useCallback((value: boolean) => {
    peopleDirtyRef.current = value;
    dirtyRef.current =
      value || chapterDirtyRef.current || inviteDirtyRef.current;
  }, []);
  const setInviteDirty = useCallback((value: boolean) => {
    inviteDirtyRef.current = value;
    dirtyRef.current =
      value || chapterDirtyRef.current || peopleDirtyRef.current;
  }, []);
  useEffect(() => {
    let active = true;
    void loadFamilyArchive()
      .then((value) => {
        if (active) setView(value);
      })
      .catch(() => {
        if (active)
          setError(
            "Your private Chapters could not be opened. Please try again.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function refresh(
    archiveId: string | null | undefined = view?.archiveId ?? undefined,
  ) {
    const next = await loadFamilyArchive(archiveId ?? undefined);
    setView(next);
  }
  function mayLeave() {
    return (
      !dirtyRef.current ||
      window.confirm(t("Leave without saving your changes?"))
    );
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !view || !mayLeave()) return;
    setBusy(true);
    setError(null);
    key.current ??= newKey();
    try {
      let archiveId = view.archiveId;
      if (!archiveId)
        archiveId = (
          await familyRequest<{ id: string }>(
            "/archives",
            "POST",
            { title: archiveTitle.current },
            archiveKey.current,
          )
        ).id;
      const created = await familyRequest<{ id: string }>(
        "/chapters",
        "POST",
        { archiveId, title: name },
        key.current,
      );
      key.current = null;
      setName("");
      setEditing(created.id);
      setCurrentDirty(false);
      await refresh(archiveId);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your private Chapters could not be opened. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function more(which: "memories" | "chapters") {
    if (!view || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await loadFamilyArchive(
        view.archiveId ?? undefined,
        which === "memories" ? (view.nextMemoryCursor ?? undefined) : undefined,
        which === "chapters"
          ? (view.nextChapterCursor ?? undefined)
          : undefined,
      );
      setView((current) =>
        current
          ? {
              ...next,
              memories:
                which === "memories"
                  ? [
                      ...current.memories,
                      ...next.memories.filter(
                        (item) =>
                          !current.memories.some((old) => old.id === item.id),
                      ),
                    ]
                  : current.memories,
              nextMemoryCursor:
                which === "memories"
                  ? next.nextMemoryCursor
                  : current.nextMemoryCursor,
              chapters:
                which === "chapters"
                  ? [
                      ...current.chapters,
                      ...next.chapters.filter(
                        (item) =>
                          !current.chapters.some((old) => old.id === item.id),
                      ),
                    ]
                  : current.chapters,
              nextChapterCursor:
                which === "chapters"
                  ? next.nextChapterCursor
                  : current.nextChapterCursor,
            }
          : next,
      );
    } catch {
      setError("Your private Chapters could not be opened. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const saved = useCallback(async (archiveId?: string) => {
    const next = await loadFamilyArchive(archiveId);
    setView((previous) =>
      previous
        ? {
            ...next,
            memories: [
              ...previous.memories.map(
                (memory) =>
                  next.memories.find((item) => item.id === memory.id) ?? memory,
              ),
              ...next.memories.filter(
                (memory) =>
                  !previous.memories.some((old) => old.id === memory.id),
              ),
            ],
          }
        : next,
    );
  }, []);
  const memoryChanged = useCallback(
    (memory: FamilyMemory) =>
      setView((current) =>
        current
          ? {
              ...current,
              memories: current.memories.some((item) => item.id === memory.id)
                ? current.memories.map((item) =>
                    item.id === memory.id ? memory : item,
                  )
                : [...current.memories, memory],
            }
          : current,
      ),
    [],
  );
  return (
    <section
      className="memory-review-section family-archive-panel"
      aria-label={t("Private Chapters")}
    >
      <h2>{t("Chapters")}</h2>
      <Link to="/family" className="secondary-action">
        {t("Memories shared with me")}
      </Link>
      <p>
        {t(
          "Bring related Living Memories together. Removing a Chapter keeps your photographs and voices in your archive.",
        )}
      </p>
      {error && <p role="alert">{notice(error)}</p>}
      {!view ? (
        <button
          type="button"
          className="secondary-action"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void refresh()
              .catch(() =>
                setError(
                  "Your private Chapters could not be opened. Please try again.",
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          {t("Recheck Chapters")}
        </button>
      ) : (
        <>
          {view.archives.length > 0 && (
            <label>
              {t("Album")}
              <select
                aria-label={t("Album")}
                value={view.archiveId ?? ""}
                disabled={busy}
                onChange={(event) => {
                  if (!mayLeave()) return;
                  setEditing(null);
                  setCurrentDirty(false);
                  setBusy(true);
                  void refresh(event.target.value)
                    .catch(() =>
                      setError(
                        "Your private Chapters could not be opened. Please try again.",
                      ),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                {view.archives.map((archive) => (
                  <option key={archive.id} value={archive.id}>
                    {archive.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {view.archiveId && (
            <PeoplePanel
              key={view.archiveId}
              archiveId={view.archiveId}
              memories={view.memories}
              onDirty={setPeopleDirty}
            />
          )}
          {view.archiveId && (
            <FamilyInvitationsPanel
              key={`invite_${view.archiveId}`}
              view={view}
              onDirty={setInviteDirty}
            />
          )}
          {!editing && (
            <form onSubmit={(event) => void create(event)}>
              <label>
                {t("Chapter name")}
                <input
                  value={name}
                  maxLength={limits.titleCharacters}
                  required
                  disabled={busy}
                  onChange={(event) => {
                    setName(event.target.value);
                    key.current = null;
                  }}
                />
              </label>
              <button
                type="submit"
                className="primary-action"
                disabled={busy || !name.trim()}
              >
                {t("Create a private Chapter")}
              </button>
            </form>
          )}
          <ul className="archive-list">
            {view.chapters.map((chapter) => (
              <li key={chapter.id}>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    if (mayLeave()) {
                      setEditing(chapter.id);
                      setCurrentDirty(false);
                    }
                  }}
                >
                  <strong>{chapter.title}</strong>
                  <span>
                    {t("{count} Living Memories", {
                      count: chapter.memoryIds.length,
                    })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {view.nextChapterCursor && (
            <button
              type="button"
              className="secondary-action"
              disabled={busy}
              onClick={() => void more("chapters")}
            >
              {t("More Chapters")}
            </button>
          )}
          {editing && (
            <ChapterEditor
              key={editing}
              id={editing}
              view={view}
              onDirty={setCurrentDirty}
              onClose={() => {
                if (mayLeave()) {
                  setEditing(null);
                  setCurrentDirty(false);
                }
              }}
              onSaved={saved}
              onMemoryChanged={memoryChanged}
              onMoreMemories={() => void more("memories")}
              busy={busy}
            />
          )}
          {!editing && view.archiveId && (
            <ArchiveSettings
              key={view.archiveId}
              view={view}
              onDirty={setCurrentDirty}
              onChanged={async (id) => {
                await refresh(id);
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
function ChapterEditor({
  id,
  view,
  onDirty,
  onClose,
  onSaved,
  onMemoryChanged,
  onMoreMemories,
  busy,
}: {
  id: string;
  view: FamilyArchiveIndex;
  onDirty: (dirty: boolean) => void;
  onClose: () => void;
  onSaved: (archiveId?: string) => Promise<void>;
  onMemoryChanged: (memory: FamilyMemory) => void;
  onMoreMemories: () => void;
  busy: boolean;
}) {
  const [chapter, setChapter] = useState<FamilyChapter | null>(null),
    [baseline, setBaseline] = useState(""),
    [error, setError] = useState<string | null>(null),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(false),
    [visible, setVisible] = useState<number>(limits.listingPageSize),
    [metadata, setMetadata] = useState<Record<string, FamilyMemory | null>>({}),
    [titleDrafts, setTitleDrafts] = useState<Record<string, boolean>>({});
  const key = useRef<string | null>(null),
    fetching = useRef(new Set<string>()),
    mounted = useRef(true),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void loadChapter(id)
      .then(({ chapter: value }) => {
        if (active) {
          setChapter(value);
          setBaseline(JSON.stringify(value));
        }
      })
      .catch(() => {
        if (active)
          setError(
            "This Chapter could not be opened. Your Living Memories are unchanged.",
          );
      });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    if (chapter) heading.current?.focus();
  }, [chapter?.id]);
  const dirty = Boolean(chapter && JSON.stringify(chapter) !== baseline);
  const anyDirty = dirty || Object.values(titleDrafts).some(Boolean);
  useEffect(() => onDirty(anyDirty), [anyDirty, onDirty]);
  const lookup = (memoryId: string) =>
    memoryId in metadata
      ? metadata[memoryId]
      : view.memories.find((memory) => memory.id === memoryId);
  useEffect(() => {
    if (!chapter) return;
    const wanted = new Set([
      ...chapter.memoryIds.slice(0, visible),
      ...(chapter.coverMemoryId ? [chapter.coverMemoryId] : []),
    ]);
    for (const memoryId of wanted)
      if (
        !(memoryId in metadata) &&
        !view.memories.some((memory) => memory.id === memoryId) &&
        !fetching.current.has(memoryId)
      ) {
        fetching.current.add(memoryId);
        void loadFamilyMemory(memoryId)
          .then(({ memory }) => {
            if (mounted.current)
              setMetadata((previous) => ({ ...previous, [memoryId]: memory }));
          })
          .catch(() => {
            if (mounted.current)
              setMetadata((previous) => ({ ...previous, [memoryId]: null }));
          })
          .finally(() => {
            fetching.current.delete(memoryId);
          });
      }
  }, [chapter, visible, metadata, view.memories]);
  function change(fields: Partial<FamilyChapter>) {
    setChapter((current) => (current ? { ...current, ...fields } : null));
    key.current = null;
    setMessage(false);
  }
  async function save() {
    if (!chapter || saving) return;
    setSaving(true);
    setError(null);
    setMessage(false);
    key.current ??= newKey();
    try {
      await familyRequest(
        `/chapters/${id}`,
        "PATCH",
        {
          version: chapter.version,
          title: chapter.title,
          description: chapter.description,
          archiveId: chapter.archiveId,
          memoryIds: chapter.memoryIds,
          coverMemoryId: chapter.coverMemoryId,
        },
        key.current,
      );
      const next = (await loadChapter(id)).chapter;
      setChapter(next);
      setBaseline(JSON.stringify(next));
      key.current = null;
      setMessage(true);
      await onSaved(chapter.archiveId);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your Chapter changes could not be confirmed. Your edits are still here.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (
      !chapter ||
      !window.confirm(
        t("Remove this Chapter? Its Living Memories stay in your archive."),
      )
    )
      return;
    setSaving(true);
    setError(null);
    try {
      await familyRequest(
        `/chapters/${id}`,
        "DELETE",
        { version: chapter.version },
        newKey(),
      );
      onDirty(false);
      await onSaved(chapter.archiveId);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your Chapter changes could not be confirmed. Your edits are still here.",
      );
    } finally {
      setSaving(false);
    }
  }
  function move(index: number, step: number) {
    if (!chapter) return;
    const next = [...chapter.memoryIds],
      [item] = next.splice(index, 1);
    next.splice(index + step, 0, item!);
    change({ memoryIds: next });
  }
  function select(memoryId: string, selected: boolean) {
    if (!chapter) return;
    if (
      !selected &&
      titleDrafts[memoryId] &&
      !window.confirm(t("Discard the unsaved name for this Living Memory?"))
    )
      return;
    if (!selected)
      setTitleDrafts((previous) => ({ ...previous, [memoryId]: false }));
    change({
      memoryIds: selected
        ? [...chapter.memoryIds, memoryId]
        : chapter.memoryIds.filter((value) => value !== memoryId),
      ...(chapter.coverMemoryId === memoryId && !selected
        ? { coverMemoryId: null }
        : {}),
    });
  }
  if (!chapter)
    return (
      <div>
        {error && <p role="alert">{notice(error)}</p>}
        <button type="button" className="secondary-action" onClick={onClose}>
          {t("Close Chapter")}
        </button>
      </div>
    );
  const cover = chapter.coverMemoryId ? lookup(chapter.coverMemoryId) : null;
  return (
    <div className="memory-review-section">
      <h3 ref={heading} tabIndex={-1}>
        {t("Your private Chapter")}
      </h3>
      {cover?.photoUrl && (
        <div className="story-photo-focus">
          <img
            src={cover.photoUrl}
            alt={t("Chapter cover photograph")}
            loading="lazy"
          />
        </div>
      )}
      {chapter.coverMemoryId && !cover?.photoUrl && (
        <p>{t("The cover photograph is unavailable right now.")}</p>
      )}
      <label>
        {t("Chapter name")}
        <input
          value={chapter.title}
          maxLength={limits.titleCharacters}
          disabled={saving}
          onChange={(event) => change({ title: event.target.value })}
        />
      </label>
      <label htmlFor={"chapter-description-" + id}>
        {t("About this Chapter (optional)")}
      </label>
      <textarea
        id={"chapter-description-" + id}
        value={chapter.description}
        maxLength={limits.descriptionCharacters}
        disabled={saving}
        onChange={(event) => change({ description: event.target.value })}
      />
      {view.archives.length > 1 && (
        <label>
          {t("Move to another album")}
          <select
            aria-label={t("Move to another album")}
            value={chapter.archiveId}
            disabled={saving}
            onChange={(event) => change({ archiveId: event.target.value })}
          >
            {view.archives.map((archive) => (
              <option key={archive.id} value={archive.id}>
                {archive.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <h4>{t("Living Memories in this Chapter")}</h4>
      <ol>
        {chapter.memoryIds.slice(0, visible).map((memoryId, index) => {
          const memory = lookup(memoryId);
          return (
            <li key={memoryId}>
              <span>
                {memory?.title ??
                  t("Living Memory {number}", { number: index + 1 })}
              </span>
              {memory && (
                <MemoryTitleControl
                  memory={memory}
                  number={index + 1}
                  onDirty={(value) =>
                    setTitleDrafts((previous) =>
                      previous[memory.id] === value
                        ? previous
                        : { ...previous, [memory.id]: value },
                    )
                  }
                  onSaved={(value) => {
                    setMetadata((previous) => ({
                      ...previous,
                      [value.id]: value,
                    }));
                    onMemoryChanged(value);
                  }}
                />
              )}
              {memory && !memory.voiceAvailable && (
                <p>{t("The original voice is unavailable right now.")}</p>
              )}
              <Link
                to={`/memory/${encodeURIComponent(memoryId)}`}
                onClick={(event) => {
                  if (
                    anyDirty &&
                    !window.confirm(t("Leave without saving your changes?"))
                  )
                    event.preventDefault();
                }}
              >
                {t("Open Living Memory")}
              </Link>
              <button
                type="button"
                className="secondary-action"
                disabled={saving || index === 0}
                onClick={() => move(index, -1)}
                aria-label={t("Move Living Memory {number} up", {
                  number: index + 1,
                })}
              >
                {t("Move up")}
              </button>
              <button
                type="button"
                className="secondary-action"
                disabled={saving || index === chapter.memoryIds.length - 1}
                onClick={() => move(index, 1)}
                aria-label={t("Move Living Memory {number} down", {
                  number: index + 1,
                })}
              >
                {t("Move down")}
              </button>
              <button
                type="button"
                className="secondary-action"
                disabled={saving}
                onClick={() => select(memoryId, false)}
                aria-label={t("Remove Living Memory {number} from Chapter", {
                  number: index + 1,
                })}
              >
                {t("Remove from Chapter")}
              </button>
            </li>
          );
        })}
      </ol>
      {visible < chapter.memoryIds.length && (
        <button
          type="button"
          className="secondary-action"
          onClick={() => setVisible((count) => count + limits.listingPageSize)}
        >
          {t("More Living Memories")}
        </button>
      )}
      <fieldset disabled={saving}>
        <legend>{t("Choose Living Memories for this Chapter")}</legend>
        {view.memories.map((memory) => (
          <label key={memory.id} className="agreement-choice">
            <input
              type="checkbox"
              checked={chapter.memoryIds.includes(memory.id)}
              onChange={(event) => select(memory.id, event.target.checked)}
            />
            {lookup(memory.id)?.title ?? t("Living Memory")}
          </label>
        ))}
      </fieldset>
      {view.nextMemoryCursor && (
        <button
          type="button"
          className="secondary-action"
          disabled={busy}
          onClick={onMoreMemories}
        >
          {t("More Living Memories")}
        </button>
      )}
      <label>
        {t("Chapter cover")}
        <select
          aria-label={t("Chapter cover")}
          value={chapter.coverMemoryId ?? ""}
          disabled={saving}
          onChange={(event) =>
            change({ coverMemoryId: event.target.value || null })
          }
        >
          <option value="">{t("No cover photograph")}</option>
          {chapter.memoryIds.map((memoryId, index) => (
            <option key={memoryId} value={memoryId}>
              {lookup(memoryId)?.title ??
                t("Living Memory {number}", { number: index + 1 })}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{notice(error)}</p>}
      {message && (
        <p role="status">{t("Your private Chapter changes are saved.")}</p>
      )}
      <button
        type="button"
        className="primary-action"
        disabled={saving || !dirty || !chapter.title.trim()}
        onClick={() => void save()}
      >
        {saving ? t("Saving Chapter…") : t("Save Chapter")}
      </button>
      <button
        type="button"
        className="secondary-action"
        disabled={saving}
        onClick={onClose}
      >
        {t("Close Chapter")}
      </button>
      <button
        type="button"
        className="secondary-action"
        disabled={saving}
        onClick={() => void remove()}
      >
        {t("Remove Chapter")}
      </button>
    </div>
  );
}
function ArchiveSettings({
  view,
  onChanged,
  onDirty,
}: {
  view: FamilyArchiveIndex;
  onChanged: (id?: string | null) => Promise<void>;
  onDirty: (value: boolean) => void;
}) {
  const archive = view.archives.find((item) => item.id === view.archiveId)!;
  const [title, setTitle] = useState(archive.title),
    [description, setDescription] = useState(archive.description),
    [nextName, setNextName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const [baseVersion, setBaseVersion] = useState(archive.version),
    [snapshot, setSnapshot] = useState(
      JSON.stringify({
        title: archive.title,
        description: archive.description,
      }),
    );
  useEffect(
    () =>
      onDirty(
        JSON.stringify({ title, description }) !== snapshot ||
          Boolean(nextName),
      ),
    [title, description, nextName, snapshot, onDirty],
  );
  async function action(kind: "save" | "create" | "delete") {
    if (busy) return;
    if (
      kind === "delete" &&
      !window.confirm(
        t(
          "Remove this album and its Chapters? Your Living Memories will stay protected.",
        ),
      )
    )
      return;
    setBusy(true);
    setError(null);
    key.current ??= newKey();
    try {
      const result = await familyRequest<{ id: string; version: number }>(
        kind === "create" ? "/archives" : `/archives/${archive.id}`,
        kind === "create" ? "POST" : kind === "delete" ? "DELETE" : "PATCH",
        kind === "create"
          ? { title: nextName }
          : kind === "delete"
            ? { version: baseVersion }
            : { title, description, version: baseVersion },
        key.current,
      );
      key.current = null;
      if (kind === "save") {
        setBaseVersion(result.version);
        setSnapshot(JSON.stringify({ title, description }));
      }
      if (kind !== "save") {
        setNextName("");
        onDirty(false);
      }
      await onChanged(kind === "delete" ? null : result.id);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your Chapter changes could not be confirmed. Your edits are still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>{t("Album settings")}</summary>
      <label>
        {t("Album name")}
        <input
          value={title}
          maxLength={limits.titleCharacters}
          disabled={busy}
          onChange={(event) => {
            setTitle(event.target.value);
            key.current = null;
          }}
        />
      </label>
      <label htmlFor={"archive-description-" + archive.id}>
        {t("About this album (optional)")}
      </label>
      <textarea
        id={"archive-description-" + archive.id}
        value={description}
        maxLength={limits.descriptionCharacters}
        disabled={busy}
        onChange={(event) => {
          setDescription(event.target.value);
          key.current = null;
        }}
      />
      <button
        type="button"
        className="secondary-action"
        disabled={busy || !title.trim()}
        onClick={() => void action("save")}
      >
        {t("Save album details")}
      </button>
      <p>
        {t(
          "An album holds Chapters. For example, an album “Family vacation” with a Chapter “Places we visited”.",
        )}
      </p>
      <p>{t("Ideas for a new album")}</p>
      {albumIdeas.map((idea) => (
        <button
          key={idea}
          type="button"
          disabled={busy}
          onClick={() => {
            setNextName(t(idea));
            key.current = null;
          }}
        >
          {t(idea)}
        </button>
      ))}
      <label>
        {t("New album name")}
        <input
          value={nextName}
          maxLength={limits.titleCharacters}
          disabled={busy}
          onChange={(event) => {
            setNextName(event.target.value);
            key.current = null;
          }}
        />
      </label>
      <button
        type="button"
        className="secondary-action"
        disabled={busy || !nextName.trim()}
        onClick={() => void action("create")}
      >
        {t("Create an album")}
      </button>
      <button
        type="button"
        className="secondary-action"
        disabled={busy}
        onClick={() => void action("delete")}
      >
        {t("Remove album")}
      </button>
      {error && <p role="alert">{notice(error)}</p>}
    </details>
  );
}
function MemoryTitleControl({
  memory,
  number,
  onSaved,
  onDirty,
}: {
  memory: FamilyMemory;
  number: number;
  onSaved: (memory: FamilyMemory) => void;
  onDirty: (value: boolean) => void;
}) {
  const [title, setTitle] = useState(memory.title ?? ""),
    [version, setVersion] = useState(memory.titleVersion),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState(false);
  const key = useRef<string | null>(null);
  useEffect(
    () => onDirty(title !== (memory.title ?? "")),
    [title, memory.title, onDirty],
  );
  async function save() {
    setBusy(true);
    setError(null);
    key.current ??= newKey();
    try {
      await familyRequest(
        `/memories/${memory.id}`,
        "PATCH",
        { title, version },
        key.current,
      );
      const next = (await loadFamilyMemory(memory.id)).memory;
      setVersion(next.titleVersion);
      setTitle(next.title ?? "");
      onSaved(next);
      key.current = null;
      setSaved(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your Chapter changes could not be confirmed. Your edits are still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <label>
        {t("Living Memory name")}
        <input
          value={title}
          maxLength={limits.titleCharacters}
          disabled={busy}
          aria-label={t("Name for Living Memory {number}", { number })}
          onChange={(event) => {
            setTitle(event.target.value);
            key.current = null;
            setSaved(false);
          }}
        />
      </label>
      <button
        type="button"
        className="secondary-action"
        disabled={busy || !title.trim()}
        onClick={() => void save()}
        aria-label={t("Save name for Living Memory {number}", { number })}
      >
        {t("Save name")}
      </button>
      {saved && (
        <p role="status">
          {t(
            "Your Living Memory name is saved. Its original photograph and voice are unchanged.",
          )}
        </p>
      )}
      {error && <p role="alert">{notice(error)}</p>}
    </div>
  );
}
