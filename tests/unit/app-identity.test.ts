import { describe, expect, it } from "vitest";

import { appIdentity } from "../../config/app-identity";
import { phase1Limits } from "../../config/phase-1-limits";
import { phase1Config } from "../../config/phase-1";

describe("app identity", () => {
  it("uses memoriesmystory for every technical application identity", () => {
    expect(appIdentity.technicalName).toBe("memoriesmystory");
    expect(appIdentity.repositoryFullName).toBe("sanlorenzoprx/memoriesmystory");
    expect(appIdentity.localRepositoryPath).toBe(String.raw`C:\repos\memoriesmystory`);
    expect(appIdentity.workerName).toBe("memoriesmystory");
    expect(appIdentity.d1DatabaseName).toBe("memoriesmystory");
    expect(appIdentity.r2MediaBucketName).toBe("memoriesmystory-media");
    expect(appIdentity.processingQueueName).toBe("memoriesmystory-processing");
    expect(appIdentity.pwaShortName).toBe("memoriesmystory");
  });

  it("keeps the current first-free-Living-Memory limits centralized", () => {
    expect(phase1Limits.freeMemoryStoryCount).toBe(
      phase1Config.entitlements.freeStoryLimit
    );
    expect(phase1Limits.freeMemoryStoryCount).toBe(1);
    expect(phase1Limits.freeVoiceSecondsPerStory).toBe(30);
    expect(phase1Config.entitlements.shareRewardEnabled).toBe(false);
  });
});
