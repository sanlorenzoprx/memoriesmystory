export type LegacyMode = "in_person" | "remote";
export type LegacyConsent = "pending" | "accepted" | "declined";
export const legacyConsentVersion = "legacy-recording-v1";
export type LegacyParticipant = {
  id: string;
  role: "host" | "guest";
  displayName: string | null;
  consent: LegacyConsent;
  joined: boolean;
  revoked: boolean;
};
export function participantsAllowRecording(
  participants: readonly LegacyParticipant[],
): boolean {
  const active = participants.filter((p) => !p.revoked);
  return (
    active.length === 2 &&
    active.some((p) => p.role === "host") &&
    active.some((p) => p.role === "guest") &&
    active.every((p) => p.joined && p.consent === "accepted")
  );
}
export type LegacySessionView = {
  id: string;
  memoryId?:string;
  mode: LegacyMode;
  status: "draft" | "live" | "paused" | "ready" | "closed";
  version: number;
  consentEpoch: number;
  consentVersion: string;
  actorId: string;
  actorRole: "host" | "guest";
  photoUrl: string;
  participants: LegacyParticipant[];
  canRecord: boolean;
};

export type LegacyRecordingReceipt = {
  recordingId: string;
  status: "durable";
  sha256: string;
  byteSize: number;
  durationMs: number;
  interrupted: boolean;
  capturedByParticipantId: string;
  photoAssetId: string;
  consentEpoch: number;
  durableAt: string;
};
export type LegacySpeakerClaim = {
  id: string;
  recordingId: string;
  participantId: string;
  startMs: number;
  endMs: number;
  note: string;
  attributionType: "self_identified";
  displayName: string;
};
export type LegacyRecording = LegacyRecordingReceipt & {
  mediaUrl: string;
  attribution: "unconfirmed";
  claims: LegacySpeakerClaim[];
};
