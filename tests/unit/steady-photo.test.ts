import { afterEach, describe, it, expect, vi } from "vitest";
import {
  captureSteadyPhoto,
  abortableDelay,
  cameraFocusAssist,
} from "../../app/services/steady-photo";
import type { LocalPhoto } from "../../app/features/capture/local-draft";
const mocks = vi.hoisted(() => ({ capture: vi.fn(), inspect: vi.fn() }));
vi.mock("../../app/services/still-photo-capture", () => ({
  captureStillPhoto: mocks.capture,
}));
vi.mock("../../app/services/photo-inspection", () => ({
  inspectLocalPhoto: mocks.inspect,
}));
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});
describe("digital steadiness assistance without source reconstruction", () => {
  it("selects the most detailed unchanged candidate and records the selection", async () => {
    vi.useFakeTimers();
    const blobs = [
      new Blob(["soft"]),
      new Blob(["clear"]),
      new Blob(["soft again"]),
    ];
    mocks.capture.mockImplementation(async () => ({
      blob: blobs[mocks.capture.mock.calls.length - 1],
      acquisition: "image_capture",
    }));
    mocks.inspect.mockImplementation(
      async (blob: Blob) =>
        ({
          blob,
          sha256: String(blobs.indexOf(blob)),
          inspection: { detailScore: blob === blobs[1] ? 30 : 5 },
          capture: {
            method: "image_capture",
            orientation: "landscape",
            orientationBasis: "browser_decoded",
          },
        }) as LocalPhoto,
    );
    const pending = captureSteadyPhoto(
      {} as HTMLVideoElement,
      {} as MediaStream,
      new AbortController().signal,
    );
    await vi.runAllTimersAsync();
    const photo = await pending;
    expect(photo.blob).toBe(blobs[1]);
    expect(photo.capture?.steady).toEqual({
      method: "best-shot-v1",
      candidates: 3,
      selectedIndex: 1,
    });
  });
  it("cancels the shutter delay immediately", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = abortableDelay(1500, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("requests continuous focus only when supported and tolerates refusal", async () => {
    const apply = vi.fn().mockRejectedValue(new Error("Unsupported"));
    await cameraFocusAssist({
      getCapabilities: () => ({}),
      applyConstraints: apply,
    } as unknown as MediaStreamTrack);
    expect(apply).not.toHaveBeenCalled();
    await cameraFocusAssist({
      getCapabilities: () => ({ focusMode: ["continuous"] }),
      applyConstraints: apply,
    } as unknown as MediaStreamTrack);
    expect(apply).toHaveBeenCalledWith({
      advanced: [{ focusMode: "continuous" }],
    });
  });
});
