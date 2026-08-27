import { assessPhotoQuality } from "../features/capture/local-draft";
import type {
  CaptureEntryMode,
  LocalPhoto,
  PhotoInspection
} from "../features/capture/local-draft";

const sampleEdge = 320;

type DecodedImage = {
  readonly source: CanvasImageSource;
  readonly width: number;
  readonly height: number;
  readonly close: () => void;
};

async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if ("createImageBitmap" in globalThis) {
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close()
    };
  }

  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.src = objectUrl;

  try {
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl)
    };
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error("This browser could not read that photograph.");
  }
}

function calculateInspection(image: DecodedImage): PhotoInspection {
  const scale = Math.min(1, sampleEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("This browser could not inspect that photograph.");
  }

  context.drawImage(image.source, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const luminance = new Float32Array(width * height);
  let total = 0;
  let brightPixels = 0;

  for (let pixel = 0; pixel < luminance.length; pixel += 1) {
    const offset = pixel * 4;
    const value =
      (pixels[offset] ?? 0) * 0.2126 +
      (pixels[offset + 1] ?? 0) * 0.7152 +
      (pixels[offset + 2] ?? 0) * 0.0722;
    luminance[pixel] = value;
    total += value;
    if (value > 245) {
      brightPixels += 1;
    }
  }

  const averageLuminance = total / luminance.length;
  let variance = 0;
  let detail = 0;
  let comparisons = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const value = luminance[index] ?? 0;
      variance += (value - averageLuminance) ** 2;

      if (x > 0) {
        detail += Math.abs(value - (luminance[index - 1] ?? value));
        comparisons += 1;
      }
      if (y > 0) {
        detail += Math.abs(value - (luminance[index - width] ?? value));
        comparisons += 1;
      }
    }
  }

  return {
    width: image.width,
    height: image.height,
    averageLuminance,
    brightPixelRatio: brightPixels / luminance.length,
    contrast: Math.sqrt(variance / luminance.length),
    detailScore: comparisons > 0 ? detail / comparisons : 0
  };
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function inspectLocalPhoto(
  blob: Blob,
  source: CaptureEntryMode
): Promise<LocalPhoto> {
  const image = await decodeImage(blob);

  try {
    const inspection = calculateInspection(image);
    return {
      blob,
      mimeType: blob.type,
      byteSize: blob.size,
      sha256: await sha256(blob),
      source,
      capturedAt: new Date().toISOString(),
      inspection,
      warning: assessPhotoQuality(inspection),
      acceptedAt: null
    };
  } finally {
    image.close();
  }
}
