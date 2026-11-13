-- Corrected pixels remain an enhanced_photo with an immutable original source.
CREATE TABLE archival_scan_provenance (
  asset_id TEXT PRIMARY KEY REFERENCES media_assets(id) ON DELETE CASCADE,
  source_asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  source_sha256 TEXT NOT NULL CHECK(length(source_sha256)=64),
  transform_json TEXT NOT NULL CHECK(json_valid(transform_json)),
  metadata_basis TEXT NOT NULL DEFAULT 'browser_reported' CHECK(metadata_basis='browser_reported'),
  actor_type TEXT NOT NULL CHECK(actor_type IN ('anonymous','owner')),
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE TRIGGER archival_scan_source_scope BEFORE INSERT ON archival_scan_provenance
WHEN NOT EXISTS (
  SELECT 1 FROM media_assets scan JOIN media_assets source ON source.id=NEW.source_asset_id
  WHERE scan.id=NEW.asset_id AND scan.role='enhanced_photo' AND scan.source_asset_id=source.id
    AND scan.draft_id=source.draft_id AND source.role='original_photo'
    AND source.sha256=NEW.source_sha256 AND source.durability_status='durable'
)
BEGIN SELECT RAISE(ABORT,'scan requires its durable original source'); END;
CREATE TRIGGER archival_scan_provenance_immutable BEFORE UPDATE OF asset_id,source_asset_id,source_sha256,transform_json,metadata_basis,actor_type,created_at ON archival_scan_provenance
BEGIN SELECT RAISE(ABORT,'scan provenance is immutable'); END;
CREATE TRIGGER archival_scan_identity_immutable BEFORE UPDATE OF id,role,draft_id,source_asset_id,r2_key,content_type,byte_size,sha256 ON media_assets
WHEN EXISTS (SELECT 1 FROM archival_scan_provenance WHERE asset_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'scan identity is immutable'); END;
