export type RemoteRecordingPhase =
  | "queued"
  | "allocating_track"
  | "queued_composite"
  | "allocating_composite"
  | "preparing"
  | "recording"
  | "stopping"
  | "processing"
  | "preserved"
  | "partial_preserved"
  | "needs_review"
  | "failed"
  | "discarded";
export type RemoteRecordingView = {
  id: string;
  phase: RemoteRecordingPhase;
  captureStopped: boolean;
  requestedAt: string;
  preservedAt: string | null;
  completeness: "review_required";
  sources: {
    id: string;
    kind: "composite_video" | "participant_audio";
    participantId: string | null;
    byteSize: number;
    sha256: string;
    mediaUrl: string;
    speakerConfirmed: boolean;
  }[];
};
