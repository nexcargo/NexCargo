-- NexCargo C7-004 Corrective: Document Deduplication Unique Constraint
-- Prevents duplicate document rows with same file_hash + linked_entity_type + linked_entity_id
-- Partial index excludes soft-deleted records so re-uploads after delete are permitted.
-- Safe for versioning: version snapshots live in a separate table (document_versions).

BEGIN;

-- Create partial unique index: active documents cannot share (file_hash, linked_entity_type, linked_entity_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_dedup_active 
ON logistics_schema.documents (file_hash, linked_entity_type, linked_entity_id)
WHERE is_deleted = false;

COMMIT;
