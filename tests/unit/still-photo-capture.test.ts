import { afterEach, describe, expect, it, vi } from "vitest";
import { captureStillPhoto, validatePhotoBlob } from "../../app/services/still-photo-capture";
import { phase1Config } from "../../config/phase-1";

const track = { readyState: "live" } as MediaStreamTrack;
const stream = { getVideoTracks: () => [track] } as unknown as MediaStream;
const video = { videoWidth: 2400, videoHeight: 1800 } as HTMLVideoElement;
const native = new Blob(["untouched-native-camera-source"], { type: "image/jpeg" });
function installCamera(camera: object) {
  vi.stubGlobal("ImageCapture", class { constructor() { return camera; } });
}
function installCanvas() {
  const frame = new Blob(["frame"], { type: "image/jpeg" });
  const draw = vi.fn();
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: draw }), toBlob: (done: (blob: Blob) => void) => done(frame) };
  const createElement = vi.fn(() => canvas);
  vi.stubGlobal("document", { createElement });
  return { frame, canvas, draw, createElement };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("archival still-photo acquisition", () => {
  it("requests maximum reported still dimensions and returns the exact source blob", async () => {
    const canvas = installCanvas();
    const takePhoto = vi.fn(async () => native);
    installCamera({ takePhoto, getPhotoCapabilities: async () => ({ imageWidth: { max: 6000 }, imageHeight: { max: 4000 } }) });
    const captured = await captureStillPhoto(video, stream);
    expect(captured).toEqual({ blob: native, acquisition: "image_capture" });
    expect(captured.blob).toBe(native);
    expect(takePhoto).toHaveBeenCalledWith({ imageWidth: 6000, imageHeight: 4000 });
    expect(canvas.createElement).not.toHaveBeenCalled();
  });

  it("uses default still capture when capability discovery fails", async () => {
    const takePhoto = vi.fn(async () => native);
    installCamera({ takePhoto, getPhotoCapabilities: async () => { throw new Error("Not implemented"); } });
    expect((await captureStillPhoto(video, stream)).blob).toBe(native);
    expect(takePhoto).toHaveBeenCalledWith({});
  });

  it("retries the device default if maximum still settings are rejected", async () => {
    const takePhoto = vi.fn().mockRejectedValueOnce(new Error("Unsupported size pair")).mockResolvedValue(native);
    installCamera({ takePhoto, getPhotoCapabilities: async () => ({ imageWidth: { max: 6000 }, imageHeight: { max: 4000 } }) });
    expect((await captureStillPhoto(video, stream)).acquisition).toBe("image_capture");
    expect(takePhoto.mock.calls).toEqual([[{ imageWidth: 6000, imageHeight: 4000 }], []]);
  });

  it.each(["missing", "throwing", "rejected"])("keeps a full preview-sized fallback when the still API is %s", async (mode) => {
    const { frame, canvas, draw } = installCanvas();
    if (mode === "missing") vi.stubGlobal("ImageCapture", undefined);
    else if (mode === "throwing") vi.stubGlobal("ImageCapture", class { constructor() { throw new Error("Unsupported track"); } });
    else installCamera({ takePhoto: async () => { throw new Error("Still not supported"); } });
    expect(await captureStillPhoto(video, stream)).toEqual({ blob: frame, acquisition: "video_frame" });
    expect([canvas.width, canvas.height]).toEqual([2400, 1800]);
    expect(draw).toHaveBeenCalledWith(video, 0, 0);
  });

  it("recovers a stalled still request using the device default and ignores the late result", async () => {
    vi.useFakeTimers();
    let finish!: (blob: Blob) => void;
    const takePhoto = vi.fn().mockImplementationOnce(() => new Promise<Blob>((resolve) => { finish = resolve; })).mockResolvedValue(native);
    installCamera({ takePhoto });
    const pending = captureStillPhoto(video, stream);
    await vi.advanceTimersByTimeAsync(phase1Config.capture.stillRequestTimeoutMs);
    const captured = await pending;
    finish(new Blob(["late result"], { type: "image/jpeg" }));
    expect(captured.blob).toBe(native);
    expect(takePhoto).toHaveBeenCalledTimes(2);
  });

  it("cancels a pending capture without falling back or accepting its late result", async () => {
    const { createElement } = installCanvas();
    const controller = new AbortController();
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    let finish!: (blob: Blob) => void;
    installCamera({ takePhoto: () => new Promise<Blob>((resolve) => { finish = resolve; started(); }) });
    const pending = captureStillPhoto(video, stream, controller.signal);
    await ready;
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    finish(native);
    expect(createElement).not.toHaveBeenCalled();
  });

  it("does not replace an oversized native still with a smaller preview", async () => {
    const { createElement } = installCanvas();
    installCamera({ takePhoto: async () => new Blob([new Uint8Array(phase1Config.media.maxImageBytes + 1)], { type: "image/jpeg" }) });
    await expect(captureStillPhoto(video, stream)).rejects.toThrow(/too large/i);
    expect(createElement).not.toHaveBeenCalled();
  });

  it("keeps a not-ready camera recoverable and rejects empty or unsupported files", async () => {
    vi.stubGlobal("ImageCapture", undefined);
    await expect(captureStillPhoto({ videoWidth: 0 } as HTMLVideoElement, stream)).rejects.toThrow(/getting ready/i);
    expect(() => validatePhotoBlob(new Blob([], { type: "image/jpeg" }))).toThrow(/not captured/i);
    expect(() => validatePhotoBlob(new Blob(["vector"], { type: "image/svg+xml" }))).toThrow(/Choose a JPEG/i);
  });
});
