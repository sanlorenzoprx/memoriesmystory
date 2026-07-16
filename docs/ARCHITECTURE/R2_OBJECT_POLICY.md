# R2 Private Media Object Policy

**Status:** Packet 1 binding contract

## Bucket boundary

`MEDIA_BUCKET` is private. The application never exposes a public bucket URL. Owner playback and deliberately shared projections pass through authorized Worker routes; short-lived signed access may be added only without exposing unrelated objects.

## Immutable identity keys

```text
drafts/{draftId}/assets/{assetId}/original.{ext}
accounts/{accountId}/memory-stories/{storyId}/assets/{assetId}/original.{ext}
accounts/{accountId}/memory-stories/{storyId}/assets/{sourceAssetId}/derivatives/{derivativeId}.{ext}
```

Every upload attempt that represents a new original receives a new asset ID. Rerecording, recapturing, enhancement, cleanup, or reprocessing never overwrites an existing object. Derivatives have their own identity and provenance.

Key builders accept only safe identifier characters and normalized extensions. Original user filenames, email addresses, story titles, and other personal content never enter object keys.

## Durable evidence

An object is not described as durable until R2 accepts the full object and D1 records its key, byte size, SHA-256, entity tag, durability state, owner/draft scope, and correlation identity. A later authorized read must independently find the record. Client state is never durability evidence.

## Access and scale

- Authorization checks use D1 ownership/share records before R2 access.
- Range-capable authorized routes support audio playback where practical.
- Delivery derivatives may be cached under an explicit policy; originals use stronger private controls.
- Prefixes distribute objects by account/story/asset identity and support bounded export or deletion jobs without bucket-wide scans.
- Lifecycle or deletion rules remain disabled until the approved retention/deletion policy exists.
