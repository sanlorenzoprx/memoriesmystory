import { apiMessageKey } from "../localization/errors";
import type { ScanTransform } from "../domain/photo-scan";
import type { LocalMemoryDraft } from "../features/capture/local-draft";

export async function uploadPhotoScan(draft: LocalMemoryDraft): Promise<void> {
  const scan = draft.scan,
    source = draft.photoUpload;
  if (
    !scan ||
    !source?.receipt ||
    source.status !== "durable" ||
    scan.sourceSha256 !== draft.photo?.sha256
  )
    throw new Error(
      "The original photo must finish backing up before its scan.",
    );
  const response = await fetch(
    `/resources/drafts/${encodeURIComponent(draft.id)}/scans`,
    {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "image/jpeg",
        "X-Memories-Request": "scan-v1",
        "X-Draft-Token": draft.draftToken,
        "X-Asset-ID": scan.upload.assetId,
        "X-Source-Asset-ID": source.assetId,
        "X-Source-SHA256": scan.sourceSha256,
        "X-Content-SHA256": scan.sha256,
        "X-Idempotency-Key": scan.upload.idempotencyKey,
        "X-Scan-Transform": JSON.stringify(scan.transform),
      },
      body: scan.blob,
    },
  );
  const body = (await response.json().catch(() => ({}))) as {
    assetId?: string;
    sha256?: string;
    error?: { code?: string };
  };
  if (!response.ok)
    throw new Error(
      apiMessageKey(
        body.error?.code,
        "Your scan is still on this device. Its backup needs another try.",
      ),
    );
  if (body.assetId !== scan.upload.assetId || body.sha256 !== scan.sha256)
    throw new Error(
      "Your scan is still on this device. Its backup needs another try.",
    );
}
export type SavedPhotoScan = {
  assetId: string;
  sourceAssetId: string;
  sourceSha256: string;
  sha256: string;
  transform: ScanTransform;
  createdAt: string;
  mediaUrl: string;
  metadataBasis: "browser_reported";
};
export async function loadPhotoScans(
  draftId: string,
  draftToken?: string,
): Promise<SavedPhotoScan[]> {
  const response = await fetch(
    `/resources/drafts/${encodeURIComponent(draftId)}/scans`,
    {
      credentials: "same-origin",
      headers: draftToken ? { "X-Draft-Token": draftToken } : {},
    },
  );
  if (!response.ok)
    throw new Error(
      "Your corrected scans could not be opened. Your originals remain available.",
    );
  return ((await response.json()) as { scans: SavedPhotoScan[] }).scans;
}
