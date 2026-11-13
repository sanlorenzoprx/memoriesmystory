export type ScanPoint = { readonly x: number; readonly y: number };
export type ScanCorners = readonly [ScanPoint, ScanPoint, ScanPoint, ScanPoint];
export const defaultScanCorners: ScanCorners = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
export type ScanTransform = {
  readonly version: "perspective-v1";
  readonly corners: ScanCorners;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly outputWidth: number;
  readonly outputHeight: number;
  readonly sourceAcquisition?:
    | "device_picker"
    | "image_capture"
    | "video_frame"
    | "file_import"
    | "unknown";
  readonly rotation?: 0 | 90 | 180 | 270;
  readonly coordinateBasis: "browser_decoded";
};
export function validCorners(value: unknown): value is ScanCorners {
  if (!Array.isArray(value) || value.length !== 4) return false;
  const points = value as ScanPoint[];
  if (
    points.some(
      (p) =>
        !p ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.x < 0 ||
        p.x > 1 ||
        p.y < 0 ||
        p.y > 1,
    )
  )
    return false;
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = points[i]!,
      b = points[(i + 1) % 4]!,
      c = points[(i + 2) % 4]!;
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) <= 0.0001)
      return false;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2 >= 0.02;
}
export function validTransform(value: unknown): value is ScanTransform {
  if (!value || typeof value !== "object") return false;
  const t = value as ScanTransform;
  return (
    (t.rotation === undefined || [0, 90, 180, 270].includes(t.rotation)) &&
    t.version === "perspective-v1" &&
    t.coordinateBasis === "browser_decoded" &&
    validCorners(t.corners) &&
    [t.sourceWidth, t.sourceHeight, t.outputWidth, t.outputHeight].every(
      (n) => Number.isInteger(n) && n >= 2 && n <= 40000,
    )
  );
}

// Inverse projective map from the output unit rectangle into the selected source quadrilateral.
export function scanProjection(
  c: ScanCorners,
): (x: number, y: number) => ScanPoint {
  if (!validCorners(c))
    throw new Error(
      "Choose four corners around the photograph without crossing the edges.",
    );
  const [a, b, d, e] = c;
  const dx1 = b.x - d.x,
    dx2 = e.x - d.x,
    dx3 = a.x - b.x + d.x - e.x;
  const dy1 = b.y - d.y,
    dy2 = e.y - d.y,
    dy3 = a.y - b.y + d.y - e.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / denominator,
    h = (dx1 * dy3 - dx3 * dy1) / denominator;
  return (x, y) => {
    const w = g * x + h * y + 1;
    return {
      x: ((b.x - a.x + g * b.x) * x + (e.x - a.x + h * e.x) * y + a.x) / w,
      y: ((b.y - a.y + g * b.y) * x + (e.y - a.y + h * e.y) * y + a.y) / w,
    };
  };
}

export function normalizedTransform(value: ScanTransform): ScanTransform {
  return {
    version: "perspective-v1",
    corners: value.corners.map((p) => ({
      x: p.x,
      y: p.y,
    })) as unknown as ScanCorners,
    sourceWidth: value.sourceWidth,
    sourceHeight: value.sourceHeight,
    outputWidth: value.outputWidth,
    outputHeight: value.outputHeight,
    coordinateBasis: "browser_decoded",
    rotation: value.rotation ?? 0,
    sourceAcquisition: [
      "device_picker",
      "image_capture",
      "video_frame",
      "file_import",
    ].includes(value.sourceAcquisition ?? "")
      ? value.sourceAcquisition
      : "unknown",
  };
}

export function rotatedScanPoint(
  x: number,
  y: number,
  rotation: number,
): ScanPoint {
  if (rotation === 90) return { x: y, y: 1 - x };
  if (rotation === 180) return { x: 1 - x, y: 1 - y };
  if (rotation === 270) return { x: 1 - y, y: x };
  return { x, y };
}
