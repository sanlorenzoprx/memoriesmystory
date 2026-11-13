// API codes select presentation copy; workflow decisions continue to use codes/status.
// Never display an arbitrary provider/server message as translated interface copy.
const messages: Readonly<Record<string, string>> = {
  legacy_invite_unavailable: "This private invitation has expired or is no longer available. Ask the host for a new conversation.",
  legacy_invite_used: "This invitation has already been used. Reopen your joined conversation on the same device.",
  legacy_self_required: "Only you can choose your recording consent.",
  legacy_consent_changed: "Recording choices changed. Review this conversation again.",
  legacy_participant_required: "This conversation is not available with your current access.",
  legacy_not_found: "This conversation is not available with your current access.",
  invalid_scan: "This scan could not be verified. Your original is unchanged.",
  scan_source_unavailable: "The original photo must finish backing up before its scan.",
  scan_backup_pending: "Your scan is still on this device. Its backup needs another try.",
  scan_too_large: "This scan is too large. Keep the original and try a smaller crop.",
  session_required: "Sign in to your archive",
  session_expired: "Sign in to your archive",
  owner_required: "Sign in to your archive",
  owner_mismatch: "That memory is not available in this account.",
  not_found: "That memory is not available in this account.",
  draft_not_found: "That memory is not available in this account.",
  review_conflict: "This memory changed on another device. Reopen the latest details before saving; your unsaved words are still here.",
  idempotency_conflict: "This request changed. Reopen the latest details before trying again.",
  source_confirmation_required: "Confirm that you want to preserve this photograph and your original voice.",
  captions_unavailable: "Captions are not ready. You can share the photograph and voice without them.",
  living_memory_limit_reached: "Your current Living Memory allowance has already been used.",
  review_paused: "Detail changes are temporarily paused. Keep your unsaved words and try again later.",
  review_too_large: "This review is too large. Shorten the text and try again.",
  invalid_context: "Stated details need your words; unknown or omitted details stay blank.",
  invalid_transcript: "The transcript cannot be blank or exceed the review limit.",
  invalid_identifier: "This request could not be verified. Refresh and try again.",
  csrf: "This request could not be verified. Refresh and try again.",
  origin: "This request could not be verified. Refresh and try again.",
  originals_not_durable: "Your originals are still being preserved. Wait for confirmation and try again.",
  share_unconfigured: "Family sharing is unavailable right now. Your memory remains private.",
  voice_reply_confirmation_required: "Review the transcript before sending your voice reply.",
  voice_reply_transcript_pending: "Your voice reply is safe. Try its transcript again without rerecording.",
  rate_limited: "Please wait a moment before trying again.",
  media_delete_failed: "Deletion did not finish. Please try again before assuming this memory is removed.",
  delete_record_failed: "Deletion needs another try to finish removing the archive record."
};
export function apiMessageKey(code: string | undefined, fallback: string): string {
  return (code && messages[code]) || fallback;
}
