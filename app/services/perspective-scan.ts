import { phase1Config } from "../../config/phase-1";
import {
  scanProjection,
  rotatedScanPoint,
  validCorners,
  type ScanCorners,
  type ScanTransform,
} from "../domain/photo-scan";
import {
  createLocalUploadState,
  type LocalPhoto,
  type LocalPhotoScan,
} from "../features/capture/local-draft";
import { decodeImage } from "./photo-inspection";

export async function createPerspectiveScan(
  source: LocalPhoto,
  corners: ScanCorners,
  signal?: AbortSignal,
  rotation: 0 | 90 | 180 | 270 = 0,
): Promise<LocalPhotoScan> {
  if (!validCorners(corners))
    throw new Error(
      "Choose four corners around the photograph without crossing the edges.",
    );
  const image = await decodeImage(source.blob);
  let imageClosed = false;
  const input = document.createElement("canvas"),
    output = document.createElement("canvas");
  try {
    signal?.throwIfAborted();
    if (image.width * image.height > phase1Config.scans.maxDecodedPixels)
      throw new Error(
        "This photo is too large to correct on this device. Your original can still be kept.",
      );
    const distance = (i: number, j: number) =>
      Math.hypot(
        (corners[i]!.x - corners[j]!.x) * image.width,
        (corners[i]!.y - corners[j]!.y) * image.height,
      );
    let width = Math.max(distance(0, 1), distance(3, 2)),
      height = Math.max(distance(0, 3), distance(1, 2));
    const scale = Math.min(
      1,
      phase1Config.scans.maxEdge / Math.max(width, height),
      Math.sqrt(phase1Config.scans.maxPixels / (width * height)),
    );
    width = Math.max(2, Math.floor(width * scale));
    height = Math.max(2, Math.floor(height * scale));
    if (rotation === 90 || rotation === 270) [width, height] = [height, width];
    const sampling = Math.min(
      1,
      phase1Config.scans.maxEdge / Math.max(image.width, image.height),
    );
    input.width = Math.max(2, Math.round(image.width * sampling));
    input.height = Math.max(2, Math.round(image.height * sampling));
    const ctx = input.getContext("2d", { willReadFrequently: true });
    output.width = width;
    output.height = height;
    const out = output.getContext("2d");
    if (!ctx || !out)
      throw new Error(
        "This device could not create the scan. Your original is still here.",
      );
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, input.width, input.height);
    ctx.drawImage(image.source, 0, 0, input.width, input.height);
    const sampleWidth = input.width,
      sampleHeight = input.height;
    const pixels = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const result = out.createImageData(width, height);
    image.close();
    imageClosed = true;
    input.width = 0;
    input.height = 0;
    const project = scanProjection(corners);
    for (let y = 0; y < height; y++) {
      if (y % 32 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        signal?.throwIfAborted();
      }
      for (let x = 0; x < width; x++) {
        const uv = rotatedScanPoint(
          x / (width - 1),
          y / (height - 1),
          rotation,
        );
        const p = project(uv.x, uv.y);
        const sx = Math.max(
          0,
          Math.min(sampleWidth - 1, p.x * (sampleWidth - 1)),
        );
        const sy = Math.max(
          0,
          Math.min(sampleHeight - 1, p.y * (sampleHeight - 1)),
        );
        const ix = Math.floor(sx),
          iy = Math.floor(sy),
          fx = sx - ix,
          fy = sy - iy;
        const x1 = Math.min(sampleWidth - 1, ix + 1),
          y1 = Math.min(sampleHeight - 1, iy + 1);
        const p00 = (iy * sampleWidth + ix) * 4,
          p10 = (iy * sampleWidth + x1) * 4;
        const p01 = (y1 * sampleWidth + ix) * 4,
          p11 = (y1 * sampleWidth + x1) * 4;
        const w00 = (1 - fx) * (1 - fy),
          w10 = fx * (1 - fy),
          w01 = (1 - fx) * fy,
          w11 = fx * fy;
        const offset = (y * width + x) * 4;
        for (let c = 0; c < 3; c++)
          result.data[offset + c] = Math.round(
            pixels[p00 + c]! * w00 +
              pixels[p10 + c]! * w10 +
              pixels[p01 + c]! * w01 +
              pixels[p11 + c]! * w11,
          );
        result.data[offset + 3] = 255;
      }
    }
    out.putImageData(result, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      output.toBlob(
        (b) =>
          b
            ? resolve(b)
            : reject(
                new Error(
                  "This device could not create the scan. Your original is still here.",
                ),
              ),
        "image/jpeg",
        phase1Config.scans.jpegQuality,
      ),
    );
    signal?.throwIfAborted();
    if (blob.size > phase1Config.media.maxImageBytes)
      throw new Error(
        "This scan is too large. Keep the original and try a smaller crop.",
      );
    const hash = await crypto.subtle.digest(
      "SHA-256",
      await blob.arrayBuffer(),
    );
    const transform: ScanTransform = {
      version: "perspective-v1",
      corners: structuredClone(corners),
      sourceWidth: image.width,
      sourceHeight: image.height,
      outputWidth: width,
      outputHeight: height,
      coordinateBasis: "browser_decoded",
      rotation,
      sourceAcquisition: source.capture?.method ?? "unknown",
    };
    return {
      blob,
      mimeType: "image/jpeg",
      byteSize: blob.size,
      sha256: Array.from(new Uint8Array(hash), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join(""),
      sourceSha256: source.sha256,
      transform,
      createdAt: new Date().toISOString(),
      upload: createLocalUploadState(),
    };
  } finally {
    if (!imageClosed) image.close();
    input.width = 0;
    input.height = 0;
    output.width = 0;
    output.height = 0;
  }
}
