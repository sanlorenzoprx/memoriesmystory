import { describe, expect, it } from "vitest";

import { appIdentity } from "../../config/app-identity";

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
});
