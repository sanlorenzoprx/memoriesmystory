export const appIdentity = {
  technicalName: "memoriesmystory",
  brandName: "Memories: My Story",
  localRepositoryPath: String.raw`C:\repos\memoriesmystory`,
  repositoryFullName: "sanlorenzoprx/memoriesmystory",
  workerName: "memoriesmystory",
  d1DatabaseName: "memoriesmystory",
  r2MediaBucketName: "memoriesmystory-media",
  processingQueueName: "memoriesmystory-processing",
  pwaShortName: "memoriesmystory"
} as const;

export type AppIdentity = typeof appIdentity;
