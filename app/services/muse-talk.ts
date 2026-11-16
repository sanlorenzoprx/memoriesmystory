import { apiMessageKey } from "../localization/errors";
import { getLocale } from "../localization/language";
import type { MuseConversationTurn } from "./living-memory-api";

export type TalkTurn = {
  readonly turnId: string;
  readonly speaker: "muse" | "person";
  readonly kind: "greeting" | "question" | "disclosure" | "support" | "family" | "words";
  readonly content: string;
  readonly support?: NonNullable<MuseConversationTurn["support"]>;
};
export type Talk = { readonly talkId: string; readonly startedAt: string; readonly turns: readonly TalkTurn[] };
export type TalkConsent = { readonly confirmed: boolean; readonly disclosureVersion: string };

const fallback = "Muse could not answer right now. Your words are safe. Please try again.";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", "X-Memories-Request": "muse-talk-v1", "X-UI-Locale": getLocale(), ...init?.headers },
  });
  const body = (await response.json().catch(() => null)) as (T & { error?: { code?: string } }) | null;
  if (!response.ok || !body) throw new Error(apiMessageKey(body?.error?.code, fallback));
  return body;
}

export const loadTalkConsent = () => call<TalkConsent>("/resources/muse/talk/consent");
export const confirmTalkConsent = (disclosureVersion: string) =>
  call<TalkConsent>("/resources/muse/talk/consent", { method: "POST", body: JSON.stringify({ adult: true, understandsAi: true, disclosureVersion }) });
export const listTalks = () => call<{ talks: { talkId: string; lastActivityAt: string }[] }>("/resources/muse/talks");
export const loadTalk = (talkId: string) => call<Talk>(`/resources/muse/talks/${encodeURIComponent(talkId)}`);
export const startTalk = () => call<Talk>("/resources/muse/talks", { method: "POST" });
export const sendToMuse = (talk: Talk, text: string) =>
  call<Talk>(`/resources/muse/talks/${encodeURIComponent(talk.talkId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ text, afterTurnId: talk.turns.at(-1)!.turnId }),
  });
export const deleteTalk = (talkId: string) => call<{ deleted: boolean }>(`/resources/muse/talks/${encodeURIComponent(talkId)}`, { method: "DELETE" });
