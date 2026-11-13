import { describe, it, expect } from "vitest";
import {
  rotatedScanPoint,
  scanProjection,
  validCorners,
  validTransform,
  normalizedTransform,
  type ScanCorners,
} from "../../app/domain/photo-scan";
describe("separate perspective scan geometry", () => {
  const corners: ScanCorners = [
    { x: 0.1, y: 0.2 },
    { x: 0.8, y: 0.1 },
    { x: 0.9, y: 0.9 },
    { x: 0.2, y: 0.8 },
  ];
  it("maps every destination corner to the selected original boundary", () => {
    const project = scanProjection(corners);
    for (const [i, [x, y]] of [
      [0, [0, 0]],
      [1, [1, 0]],
      [2, [1, 1]],
      [3, [0, 1]],
    ] as const) {
      expect(project(x, y).x).toBeCloseTo(corners[i].x, 10);
      expect(project(x, y).y).toBeCloseTo(corners[i].y, 10);
    }
    const center = project(0.5, 0.5);
    expect(center.x).toBeGreaterThan(0.1);
    expect(center.x).toBeLessThan(0.9);
  });
  it("refuses crossing, collapsed, tiny and out-of-image selections", () => {
    expect(validCorners([corners[0], corners[2], corners[1], corners[3]])).toBe(
      false,
    );
    expect(validCorners(corners.map(() => ({ x: 0.2, y: 0.2 })))).toBe(false);
    expect(validCorners([{ x: -0.1, y: 0 }, ...corners.slice(1)])).toBe(false);
    expect(
      validCorners([
        { x: 0, y: 0 },
        { x: 0.01, y: 0 },
        { x: 0.01, y: 0.01 },
        { x: 0, y: 0.01 },
      ]),
    ).toBe(false);
  });
  it("validates bounded source/output metadata and removes unrelated fields", () => {
    const value = {
      version: "perspective-v1",
      coordinateBasis: "browser_decoded",
      sourceWidth: 2000,
      sourceHeight: 1500,
      outputWidth: 1200,
      outputHeight: 900,
      corners,
      privateNote: "must not persist",
    };
    expect(validTransform(value)).toBe(true);
    expect(normalizedTransform(value as never)).not.toHaveProperty(
      "privateNote",
    );
    expect(validTransform({ ...value, sourceWidth: Infinity })).toBe(false);
    expect(validTransform({ ...value, outputWidth: 0 })).toBe(false);
  });
  it("rotates a derivative's coordinates without changing source geometry", () => {
    expect(rotatedScanPoint(0, 0, 90)).toEqual({ x: 0, y: 1 });
    expect(rotatedScanPoint(1, 0, 90)).toEqual({ x: 0, y: 0 });
    expect(rotatedScanPoint(0, 0, 180)).toEqual({ x: 1, y: 1 });
    expect(rotatedScanPoint(0, 0, 270)).toEqual({ x: 1, y: 0 });
  });
});
