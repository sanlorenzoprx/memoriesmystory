import { useEffect, useRef, useState } from "react";
import type {
  PeopleRecord,
  PersonReference,
  RelationshipReference,
} from "../../domain/family-people";
import type { FamilyMemory } from "../../domain/family-archive";
import {
  loadPeople,
  loadPersonAlbum,
  peopleRequest,
  type PersonAlbum,
} from "../../services/family-people";
import { Link } from "react-router";
import { t, notice, useLocale } from "../../localization/language";
import { phase1Config } from "../../../config/phase-1";
const blank: PersonReference = {
  label: "",
  notes: "",
  dateText: "",
  datePrecision: "unknown",
  memoryIds: [],
};
const limits = phase1Config.familyPeople;
export function PeoplePanel({
  archiveId,
  memories,
  onDirty,
}: {
  archiveId: string;
  memories: FamilyMemory[];
  onDirty: (dirty: boolean) => void;
}) {
  useLocale();
  const [records, setRecords] = useState<PeopleRecord[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState(false),
    [editing, setEditing] = useState<PeopleRecord | null>(null),
    [draft, setDraft] = useState<PersonReference>(blank),
    [history, setHistory] = useState<
      { version: number; document: PersonReference }[]
    >([]),
    [album, setAlbum] = useState<PersonAlbum | null>(null);
  const [relation, setRelation] = useState<RelationshipReference>({
    fromId: "",
    toId: "",
    label: "",
    type: "relationship",
    certainty: "uncertain",
  });
  const dirty = useRef(false),
    relationDirty = useRef(false),
    key = useRef<string | null>(null),
    relationKey = useRef<string | null>(null);
  function changed(which = "person") {
    if (which === "relationship") {
      relationDirty.current = true;
      relationKey.current = null;
    } else {
      dirty.current = true;
      key.current = null;
    }
    onDirty(true);
    setSaved(false);
  }
  function clean() {
    dirty.current = false;
    onDirty(relationDirty.current);
    key.current = null;
  }
  useEffect(() => () => onDirty(false), [onDirty]);
  async function refresh(more = false) {
    const next = await loadPeople(
      archiveId,
      more ? (cursor ?? undefined) : undefined,
    );
    setRecords((old) =>
      more
        ? [
            ...old,
            ...next.records.filter((r) => !old.some((p) => p.id === r.id)),
          ]
        : next.records,
    );
    setCursor(next.nextCursor);
    setLoaded(true);
  }
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "People could not be opened. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function mayLeave() {
    return (
      !dirty.current || window.confirm(t("Leave without saving your changes?"))
    );
  }
  async function open(record: PeopleRecord) {
    if (!mayLeave()) return;
    const value = await peopleRequest<{
      record: PeopleRecord;
      history: { version: number; document: PersonReference }[];
    }>(archiveId, `/person/${record.id}`);
    setEditing(value.record);
    setDraft(value.record.document as PersonReference);
    setHistory(value.history);
    clean();
  }
  async function save() {
    key.current ??= `people_request_${crypto.randomUUID()}`;
    const result = await peopleRequest<{ id: string; version: number }>(
      archiveId,
      editing ? `/person/${editing.id}` : "/person",
      editing ? "PATCH" : "POST",
      {
        ...(editing ? { version: editing.version } : {}),
        document: draft,
        active: true,
      },
      key.current,
    );
    const canonical = await peopleRequest<{ record: PeopleRecord }>(
      archiveId,
      `/person/${result.id}`,
    );
    await refresh();
    setEditing(canonical.record);
    setDraft(canonical.record.document as PersonReference);
    setHistory([]);
    clean();
    setSaved(true);
  }
  const people = records.filter((r) => r.kind === "person"),
    active = people.filter((r) => r.active),
    names = new Map(
      people.map((r) => [
        r.id,
        (r.document as PersonReference).label || t("Unnamed person"),
      ]),
    );
  return (
    <details className="memory-review-section">
      <summary>{t("People and relationships")}</summary>
      <p>
        {t(
          "Add only what you remember. Names, dates and relationships are your own references; uncertainty is welcome.",
        )}
      </p>
      {error && <p role="alert">{notice(error)}</p>}
      {saved && <p role="status">{t("Your people references are saved.")}</p>}
      <button
        type="button"
        className="secondary-action"
        disabled={busy}
        onClick={() => void action(() => refresh())}
      >
        {t(loaded ? "Recheck people" : "Open people")}
      </button>
      {loaded && (
        <>
          <ul className="archive-list">
            {people.map((person) => (
              <li key={person.id}>
                <span>
                  {names.get(person.id)}
                  {!person.active ? ` — ${t("Removed reference")}` : ""}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void action(() => open(person))}
                >
                  {t(
                    person.active ? "Edit person" : "Restore or review person",
                  )}
                </button>
                {person.active && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void action(async () =>
                        setAlbum(await loadPersonAlbum(archiveId, person.id)),
                      )
                    }
                  >
                    {t("Open this person's album")}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {cursor && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void action(() => refresh(true))}
            >
              {t("More people references")}
            </button>
          )}
          {album && (
            <section aria-label={t("Album of {name}", { name: album.person.label || t("Unnamed person") })}>
              <h3>
                {t("Album of {name}", {
                  name: album.person.label || t("Unnamed person"),
                })}
              </h3>
              <p>
                {t(
                  "These are the memories you linked to this person. Nothing is added by recognizing faces or voices.",
                )}
              </p>
              {album.memories.length === 0 ? (
                <p>{t("No memories are linked to this person yet.")}</p>
              ) : (
                <ul className="archive-list">
                  {album.memories.map((memory, index) => (
                    <li key={memory.id}>
                      <Link to={`/memory/${encodeURIComponent(memory.id)}`}>
                        {memory.photoUrl && (
                          <img
                            src={memory.photoUrl}
                            alt={t("Photograph from this memory")}
                            loading="lazy"
                            style={{ maxWidth: "6rem", height: "auto" }}
                          />
                        )}
                        <strong>
                          {memory.title ??
                            t("Living Memory {number}", { number: index + 1 })}
                        </strong>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={() => setAlbum(null)}>
                {t("Close this album")}
              </button>
            </section>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (mayLeave()) {
                setEditing(null);
                setDraft({ ...blank, memoryIds: [] });
                setHistory([]);
                clean();
              }
            }}
          >
            {t("Add another person")}
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(save);
            }}
          >
            <h3>{t(editing ? "Edit person" : "Add a person")}</h3>
            <fieldset disabled={busy}>
              <label htmlFor="person-label">
                {t("Name or description (optional)")}
              </label>
              <input
                id="person-label"
                value={draft.label}
                maxLength={limits.labelCharacters}
                onChange={(e) => {
                  setDraft({ ...draft, label: e.target.value });
                  changed();
                }}
              />
              <label htmlFor="person-notes">{t("Your notes (optional)")}</label>
              <textarea
                id="person-notes"
                value={draft.notes}
                maxLength={limits.notesCharacters}
                onChange={(e) => {
                  setDraft({ ...draft, notes: e.target.value });
                  changed();
                }}
              />
              <label htmlFor="person-date-precision">
                {t("How do you remember the date?")}
              </label>
              <select
                id="person-date-precision"
                value={draft.datePrecision}
                onChange={(e) => {
                  const precision = e.target
                    .value as PersonReference["datePrecision"];
                  setDraft({
                    ...draft,
                    datePrecision: precision,
                    dateText: precision === "unknown" ? "" : draft.dateText,
                  });
                  changed();
                }}
              >
                <option value="unknown">{t("Unknown or omitted")}</option>
                <option value="approximate">
                  {t("Approximate, in my recollection")}
                </option>
                <option value="known">{t("A date I remember")}</option>
              </select>
              {draft.datePrecision !== "unknown" && (
                <>
                  <label htmlFor="person-date">
                    {t("Date in your own words")}
                  </label>
                  <input
                    id="person-date"
                    value={draft.dateText}
                    maxLength={limits.dateCharacters}
                    onChange={(e) => {
                      setDraft({ ...draft, dateText: e.target.value });
                      changed();
                    }}
                  />
                </>
              )}
              <fieldset>
                <legend>
                  {t("People in these Living Memories (optional)")}
                </legend>
                {memories.map((memory, index) => (
                  <label key={memory.id}>
                    <input
                      type="checkbox"
                      checked={draft.memoryIds.includes(memory.id)}
                      onChange={(e) => {
                        setDraft({
                          ...draft,
                          memoryIds: e.target.checked
                            ? [...draft.memoryIds, memory.id]
                            : draft.memoryIds.filter((id) => id !== memory.id),
                        });
                        changed();
                      }}
                    />
                    {memory.title ||
                      t("Living Memory {number}", { number: index + 1 })}
                  </label>
                ))}
              </fieldset>
              <button type="submit" className="primary-action">
                {t(
                  editing && !editing.active
                    ? "Restore person reference"
                    : "Save person reference",
                )}
              </button>
              {editing?.active && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        t(
                          "Remove this person reference? Original memories and history stay preserved.",
                        ),
                      )
                    )
                      void action(async () => {
                        key.current ??= `people_request_${crypto.randomUUID()}`;
                        await peopleRequest(
                          archiveId,
                          `/person/${editing.id}`,
                          "DELETE",
                          { version: editing.version },
                          key.current,
                        );
                        setEditing(null);
                        setDraft({ ...blank, memoryIds: [] });
                        setHistory([]);
                        clean();
                        await refresh();
                      });
                  }}
                >
                  {t("Remove person reference")}
                </button>
              )}
            </fieldset>
          </form>
          {editing && history.length > 0 && (
            <details>
              <summary>{t("Earlier human references")}</summary>
              <p>
                {t(
                  "Choosing an earlier version prepares an edit. Save to keep it as a new attributed version.",
                )}
              </p>
              {history.map((item) => (
                <button
                  key={item.version}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setDraft(item.document);
                    changed();
                  }}
                >
                  {t("Use earlier version {number}", { number: item.version })}
                </button>
              ))}
            </details>
          )}
          <h3>{t("Relationships you remember")}</h3>
          <ul>
            {records
              .filter((r) => r.kind === "relationship" && r.active)
              .map((record) => {
                const ref = record.document as RelationshipReference;
                if (
                  !active.some((p) => p.id === ref.fromId) ||
                  !active.some((p) => p.id === ref.toId)
                )
                  return null;
                return (
                  <li key={record.id}>
                    {names.get(ref.fromId)} —{" "}
                    {ref.type === "same_person"
                      ? t("Linked by you; entries stay separate")
                      : ref.label}{" "}
                    — {names.get(ref.toId)} (
                    {t(
                      ref.certainty === "uncertain"
                        ? "Uncertain, in my recollection"
                        : ref.certainty === "unknown"
                          ? "Unknown or omitted"
                          : "As I remember it",
                    )}
                    ){" "}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          await peopleRequest(
                            archiveId,
                            `/relationship/${record.id}`,
                            "DELETE",
                            { version: record.version },
                            `people_remove_${crypto.randomUUID()}`,
                          );
                          await refresh();
                        })
                      }
                    >
                      {t("Remove relationship or link")}
                    </button>
                  </li>
                );
              })}
          </ul>
          {active.length >= 2 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  relationKey.current ??= `people_request_${crypto.randomUUID()}`;
                  await peopleRequest(
                    archiveId,
                    "/relationship",
                    "POST",
                    { document: relation },
                    relationKey.current,
                  );
                  await refresh();
                  relationDirty.current = false;
                  relationKey.current = null;
                  onDirty(dirty.current);
                  setRelation({ ...relation, label: "" });
                  setSaved(true);
                });
              }}
            >
              <fieldset disabled={busy}>
                <label>
                  {t("First person")}
                  <select
                    required
                    aria-label={t("First person")}
                    value={relation.fromId}
                    onChange={(e) => {
                      setRelation({ ...relation, fromId: e.target.value });
                      changed("relationship");
                    }}
                  >
                    <option value="">{t("Choose a person")}</option>
                    {active.map((p) => (
                      <option key={p.id} value={p.id}>
                        {t("{name} (entry {number})", {
                          name: names.get(p.id)!,
                          number:
                            people.findIndex((person) => person.id === p.id) +
                            1,
                        })}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("Second person")}
                  <select
                    required
                    aria-label={t("Second person")}
                    value={relation.toId}
                    onChange={(e) => {
                      setRelation({ ...relation, toId: e.target.value });
                      changed("relationship");
                    }}
                  >
                    <option value="">{t("Choose a person")}</option>
                    {active
                      .filter((p) => p.id !== relation.fromId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {t("{name} (entry {number})", {
                            name: names.get(p.id)!,
                            number:
                              people.findIndex((person) => person.id === p.id) +
                              1,
                          })}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  {t("Reference type")}
                  <select
                    aria-label={t("Reference type")}
                    value={relation.type}
                    onChange={(e) => {
                      setRelation({
                        ...relation,
                        type: e.target.value as RelationshipReference["type"],
                      });
                      changed("relationship");
                    }}
                  >
                    <option value="relationship">
                      {t("Relationship in my words")}
                    </option>
                    <option value="same_person">
                      {t("I want to link these entries")}
                    </option>
                  </select>
                </label>
                {relation.type === "relationship" && (
                  <label>
                    {t("Relationship in my words")}
                    <input
                      required
                      value={relation.label}
                      maxLength={limits.labelCharacters}
                      onChange={(e) => {
                        setRelation({ ...relation, label: e.target.value });
                        changed("relationship");
                      }}
                    />
                  </label>
                )}
                <label>
                  {t("How certain is your recollection?")}
                  <select
                    aria-label={t("How certain is your recollection?")}
                    value={relation.certainty}
                    onChange={(e) => {
                      setRelation({
                        ...relation,
                        certainty: e.target
                          .value as RelationshipReference["certainty"],
                      });
                      changed("relationship");
                    }}
                  >
                    <option value="uncertain">
                      {t("Uncertain, in my recollection")}
                    </option>
                    <option value="unknown">{t("Unknown or omitted")}</option>
                    <option value="stated">{t("As I remember it")}</option>
                  </select>
                </label>
                <p>
                  {t(
                    "A link keeps both entries and their history. You can remove it at any time.",
                  )}
                </p>
                <button type="submit" className="primary-action">
                  {t("Save relationship or link")}
                </button>
              </fieldset>
            </form>
          )}
        </>
      )}
    </details>
  );
}
