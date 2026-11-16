/**
 * Asks the Worker for a display copy when an original cannot be shown by the
 * browser (HEIC photographs). The Worker ignores it for every other format,
 * and data or blob URLs are left untouched. Downloads and exports keep using
 * the original URL.
 */
export function displayUrl(mediaUrl: string): string {
  if (!mediaUrl.startsWith("/")) return mediaUrl;
  return `${mediaUrl}${mediaUrl.includes("?") ? "&" : "?"}display=jpeg`;
}
