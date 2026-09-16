// NexCargo MOD-004 — Document Repository
// Handles CRUD operations across 7 linked tables in logistics_schema
// All writes use Supabase service-role key via admin client to bypass RLS

import { createAdminClient } from '@/infrastructure/database/supabase';
import type {
  Document,
  DocumentVersion,
  DocumentApprovalRecord,
  DocumentLinkageObject,
  OcrExtractionResult,
  DigitalSignatureRecord,
  DocumentExpiryRecord,
} from '../../domain/types/entities';
import type { UserRole } from '@/shared/types/enums';
import { DocumentStatus, RenewalStatus, OperationalImpact, SignatureVerificationMethod, RelationshipType } from '../../domain/enums';
import { ErrorCode, AppError, NotFoundError } from '@/shared/errors/app-errors';

type AdminClient = ReturnType<typeof createAdminClient>;

// ============================================================
// Input types for repository methods
// ============================================================

export interface DocumentCreateInput {
  documentId: string;
  documentType: string;
  linkedEntityType: string;
  linkedEntityId: string;
  status?: string;
  fileReference: string;
  fileHash: string;
  expiryDate?: string | null;
  issueDate?: string | null;
  createdBy: string;
  updatedBy: string;
  correlationId?: string | null;
}

export interface VersionCreateInput {
  documentId: string;
  versionNumber: number;
  data: Record<string, unknown>;
  changeSummary: string;
  createdBy: string;
  correlationId?: string | null;
}

export interface ApprovalCreateInput {
  documentId: string;
  approverRole: string;
  comments?: string;
  createdBy: string;
  correlationId?: string | null;
}

export interface LinkageCreateInput {
  documentId: string;
  moduleReference: string;
  entityReference: string;
  relationshipType: string;
  createdBy?: string;
  correlationId?: string | null;
}

export interface OcrCreateInput {
  documentId: string;
  extractedFields: Record<string, string>;
  confidenceScore: number;
  fieldConfidenceScores: Record<string, number>;
  createdBy: string;
  correlationId?: string | null;
}

export interface SignatureCreateInput {
  documentId: string;
  signerId: string;
  signerRole: string;
  signatureCertificate: string;
  verificationMethod: string;
  ipAddress?: string;
  userAgent?: string;
  createdBy: string;
  correlationId?: string | null;
}

export interface ExpiryCreateInput {
  documentId: string;
  documentType: string;
  linkedEntityId: string;
  issueDate: string;
  expiryDate: string;
  operationalImpact: string;
  createdBy: string;
  correlationId?: string | null;
}

// ============================================================
// Output types / row mappings
// ============================================================

interface DocumentRow {
  id: string;
  document_id: string;
  document_type: string;
  linked_entity_type: string;
  linked_entity_id: string;
  status: string;
  created_by: string;
  updated_by: string;
  file_reference: string;
  file_hash: string;
  expiry_date: string | null;
  issue_date: string | null;
  correlation_id: string | null;
  is_deleted: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

interface DocumentVersionRow {
  id: string;
  document_id: string;
  version_number: number;
  content_data: string;
  content_change_summary: string;
  created_at: string;
  created_by: string;
}

interface DocumentApprovalRow {
  id: string;
  document_id: string;
  approval_id: string;
  approver_role: string;
  approval_status: string;
  timestamp: string;
  comments: string | null;
  created_at: string;
}

interface DocumentLinkageRow {
  id: string;
  document_id: string;
  linkage_id: string;
  module_reference: string;
  entity_reference: string;
  relationship_type: string;
  created_at: string;
}

interface OcrRow {
  id: string;
  document_id: string;
  extraction_id: string;
  extracted_fields: string;
  confidence_score: number;
  field_confidence_scores: string;
  user_reviewed: boolean;
  user_corrections: string;
  processed_at: string;
  created_at: string;
}

interface SignatureRow {
  id: string;
  document_id: string;
  signature_id: string;
  signer_id: string;
  signer_role: string;
  signature_timestamp: string;
  signature_certificate: string;
  verification_method: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface ExpiryRow {
  id: string;
  document_id: string;
  expiry_record_id: string;
  document_type: string;
  linked_entity_id: string;
  issue_date: string;
  expiry_date: string;
  renewal_status: string;
  reminder_sent_at: string[];
  renewed_document_id: string | null;
  operational_impact: string;
  created_at: string;
}

interface DocumentSummaryRow {
  id: string;
  document_id: string;
  document_type: string;
  status: string;
  file_reference: string;
  file_hash: string;
  expiry_date: string | null;
  issue_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface DocumentSummary {
  id: string;
  documentId: string;
  documentType: string;
  status: string;
  fileReference: string;
  fileHash: string;
  expiryDate: string | null;
  issueDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface DocumentDetail extends Document {
  versions: DocumentVersion[];
  linkages: DocumentLinkageObject[];
  approvals: DocumentApprovalRecord[];
  ocrResults: OcrExtractionResult[];
  signatures: DigitalSignatureRecord[];
  expiryRecord: DocumentExpiryRecord | null;
}

// ============================================================
// Document Repository
// ============================================================

export class DocumentRepository {
  private readonly schema = 'logistics_schema';

  // ---- Helpers ---------------------------------------------------------

  private mapBaseEntity(dateStr: string): { created_at: Date; updated_at: Date; version: number } {
    const date = new Date(dateStr);
    return { created_at: date, updated_at: date, version: 1 };
  }

  private mapDocumentRow(row: DocumentRow): Document {
    const base = this.mapBaseEntity(row.created_at);
    return {
      ...base,
      id: row.id,
      documentId: row.document_id,
      documentType: row.document_type as Document['documentType'],
      linkedEntityType: row.linked_entity_type as Document['linkedEntityType'],
      linkedEntityId: row.linked_entity_id,
      status: row.status as Document['status'],
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      fileReference: row.file_reference,
      fileHash: row.file_hash,
      expiryDate: row.expiry_date ? new Date(row.expiry_date) : undefined,
      issueDate: row.issue_date ? new Date(row.issue_date) : undefined,
      bumpVersion: () => {},
      toJSON: () => ({ id: row.id, created_at: row.created_at, updated_at: row.updated_at, version: row.version }),
    };
  }

  private mapDocumentSummary(row: DocumentSummaryRow): DocumentSummary {
    return {
      id: row.id,
      documentId: row.document_id,
      documentType: row.document_type,
      status: row.status,
      fileReference: row.file_reference,
      fileHash: row.file_hash,
      expiryDate: row.expiry_date,
      issueDate: row.issue_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
    };
  }

  private mapVersionRow(row: DocumentVersionRow): DocumentVersion {
    const base = this.mapBaseEntity(row.created_at);
    return {
      ...base,
      id: row.id,
      versionId: row.document_id,
      documentId: row.document_id,
      versionNumber: row.version_number,
      contentSnapshot: {
        data: JSON.parse(row.content_data || '{}'),
        changeSummary: row.content_change_summary,
      },
      createdAt: new Date(row.created_at),
      createdBy: row.created_by,
      bumpVersion: () => {},
      toJSON: () => ({ id: row.id, ...base }),
    };
  }

  private mapApprovalRow(row: DocumentApprovalRow): DocumentApprovalRecord {
    const base = this.mapBaseEntity(row.created_at);
    return {
      ...base,
      id: row.id,
      approvalId: row.approval_id,
      documentId: row.document_id,
      approverRole: row.approver_role as UserRole,
      approvalStatus: row.approval_status as 'PENDING' | 'APPROVED' | 'REJECTED',
      timestamp: new Date(row.timestamp),
      comments: row.comments ?? undefined,
      bumpVersion: () => {},
      toJSON: () => ({ id: row.id, ...base }),
    };
  }

  private mapLinkageRow(row: DocumentLinkageRow): DocumentLinkageObject {
    const base = this.mapBaseEntity(row.created_at);
    return {
      ...base,
      id: row.id,
      linkageId: row.linkage_id,
      documentId: row.document_id,
      moduleReference: row.module_reference,
      entityReference: row.entity_reference,
      relationshipType: row.relationship_type as RelationshipType,
      bumpVersion: () => {},
      toJSON: () => ({ id: row.id, ...base }),
    };
  }

  private mapOcrRow(row: OcrRow): OcrExtractionResult {
    const base = this.mapBaseEntity(row.created_at);
    return {
      ...base,
      id: row.id,
      extractionId: row.extraction_id,
      documentId: row.document_id,
      extractedFields: JSON.parse(row.extracted_fields || '{}'),
      confidenceScore: row.confidence_score,
      fieldConfidenceScores: JSON.parse(row.field_confidence_scores || '{}'),
      userReviewed: row.user_reviewed,
      userCorrections: JSON.parse(row.user_corrections || '{}'),
      processedAt: new Date(row.processed_at),
      bumpVersion: () => {},
      toJSON: () => ({ id: row.id, ...base }),
    };
  }

  private mapSignatureRow(row: SignatureRow): DigitalSignatureRecord {
    const base = this.mapBaseEntity(row.created_at);
    return {
      ...base,
      id: row.id,
      signatureId: row.signature_id,
      documentId: row.document_id,
      signerId: row.signer_id,
      signerRole: row.signer_role as UserRole,
      signatureTimestamp: new Date(row.signature_timestamp),
      signatureCertificate: row.signature_certificate,
      verificationMethod: row.verification_method as SignatureVerificationMethod,
      ipAddress: row.ip_address ?? undefined,
      userAgent: row.user_agent ?? undefined,
      bumpVersion: () => {},
      toJSON: () => ({ id: row.id, ...base }),
    };
  }

  private mapExpiryRow(row: ExpiryRow): DocumentExpiryRecord {
    const base = this.mapBaseEntity(row.created_at);
    return {
      ...base,
      id: row.id,
      expiryRecordId: row.expiry_record_id,
      documentId: row.document_id,
      documentType: row.document_type as DocumentExpiryRecord['documentType'],
      linkedEntityId: row.linked_entity_id,
      issueDate: new Date(row.issue_date),
      expiryDate: new Date(row.expiry_date),
      renewalStatus: row.renewal_status as RenewalStatus,
      reminderSentAt: row.reminder_sent_at ?? [],
      renewedDocumentId: row.renewed_document_id ?? undefined,
      operationalImpact: row.operational_impact as OperationalImpact,
      bumpVersion: () => {},
      toJSON: () => ({ id: row.id, ...base }),
    };
  }

  // ---- Document operations ----------------------------------------------

  /**
   * Create a new document atomically:
   * - documents table
   * - document_linkages table (initial linkage)
   * - document_expiry_records table (if document has expiry date)
   * - document_versions table (v1 snapshot)
   */
  async create(data: DocumentCreateInput): Promise<Document> {
    const client = createAdminClient();

    try {
      // 1. Insert main document
      const docResult = await client
        .from(`${this.schema}.documents`)
        .insert({
          document_id: data.documentId,
          document_type: data.documentType,
          linked_entity_type: data.linkedEntityType,
          linked_entity_id: data.linkedEntityId,
          status: data.status ?? DocumentStatus.UPLOADED,
          created_by: data.createdBy,
          updated_by: data.updatedBy,
          file_reference: data.fileReference,
          file_hash: data.fileHash,
          expiry_date: data.expiryDate ?? null,
          issue_date: data.issueDate ?? null,
          correlation_id: data.correlationId ?? null,
        })
        .select()
        .single();

      if (docResult.error) {
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          `Failed to create document: ${docResult.error.message}`,
          { documentId: data.documentId },
        );
      }

      const docRow = docResult.data as DocumentRow;
      const insertedDoc = this.mapDocumentRow(docRow);

      // 2. Create initial linkage
      const linkageResult = await client
        .from(`${this.schema}.document_linkages`)
        .insert({
          document_id: data.documentId,
          module_reference: 'MOD-004',
          entity_reference: data.linkedEntityId,
          relationship_type: RelationshipType.SUPPORTS,
        });

      if (linkageResult.error) {
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          `Failed to create document linkage: ${linkageResult.error.message}`,
          { documentId: data.documentId },
        );
      }

      // 3. Create expiry record if document has an expiry date
      if (data.expiryDate) {
        const expiryResult = await client
          .from(`${this.schema}.document_expiry_records`)
          .insert({
            document_id: data.documentId,
            document_type: data.documentType,
            linked_entity_id: data.linkedEntityId,
            issue_date: data.issueDate ?? new Date().toISOString(),
            expiry_date: data.expiryDate,
            renewal_status: RenewalStatus.ACTIVE,
            operational_impact: OperationalImpact.NONE,
          });

        if (expiryResult.error) {
          throw new AppError(
            ErrorCode.INTERNAL_ERROR,
            `Failed to create expiry record: ${expiryResult.error.message}`,
            { documentId: data.documentId },
          );
        }
      }

      // 4. Create v1 version snapshot
      const versionData = JSON.stringify({
        documentId: data.documentId,
        documentType: data.documentType,
        linkedEntityType: data.linkedEntityType,
        linkedEntityId: data.linkedEntityId,
        fileReference: data.fileReference,
        fileHash: data.fileHash,
        status: data.status ?? DocumentStatus.UPLOADED,
      });

      const versionResult = await client
        .from(`${this.schema}.document_versions`)
        .insert({
          document_id: data.documentId,
          version_number: 1,
          content_data: versionData,
          content_change_summary: 'Initial document version',
          created_by: data.createdBy,
        });

      if (versionResult.error) {
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          `Failed to create initial version: ${versionResult.error.message}`,
          { documentId: data.documentId },
        );
      }

      return insertedDoc;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to create document', {
        documentId: data.documentId,
      });
    }
  }

  /**
   * Find a document by business identifier with all related entities.
   */
  async findById(documentId: string): Promise<DocumentDetail | null> {
    const client = createAdminClient();

    // Main document
    const docResult = await client
      .from(`${this.schema}.documents`)
      .select('*')
      .eq('document_id', documentId)
      .eq('is_deleted', false)
      .single();

    if (docResult.error) {
      if (docResult.error.code === 'PGRST116') return null;
      throw new AppError(ErrorCode.INTERNAL_ERROR, `Failed to find document: ${docResult.error.message}`);
    }

    if (!docResult.data) return null;

    const document = this.mapDocumentRow(docResult.data as DocumentRow);

    // Versions
    const versionsResult = await client
      .from(`${this.schema}.document_versions`)
      .select('*')
      .eq('document_id', documentId)
      .order('version_number', { ascending: true });

    const versions = (versionsResult.data as DocumentVersionRow[])?.map(r => this.mapVersionRow(r)) ?? [];

    // Linkages
    const linkagesResult = await client
      .from(`${this.schema}.document_linkages`)
      .select('*')
      .eq('document_id', documentId);

    const linkages = (linkagesResult.data as DocumentLinkageRow[])?.map(r => this.mapLinkageRow(r)) ?? [];

    // Approvals
    const approvalsResult = await client
      .from(`${this.schema}.document_approvals`)
      .select('*')
      .eq('document_id', documentId);

    const approvals = (approvalsResult.data as DocumentApprovalRow[])?.map(r => this.mapApprovalRow(r)) ?? [];

    // OCR results
    const ocrResult = await client
      .from(`${this.schema}.ocr_results`)
      .select('*')
      .eq('document_id', documentId);

    const ocrResults = (ocrResult.data as OcrRow[])?.map(r => this.mapOcrRow(r)) ?? [];

    // Signatures
    const sigResult = await client
      .from(`${this.schema}.digital_signatures`)
      .select('*')
      .eq('document_id', documentId);

    const signatures = (sigResult.data as SignatureRow[])?.map(r => this.mapSignatureRow(r)) ?? [];

    // Expiry record
    const expiryResult = await client
      .from(`${this.schema}.document_expiry_records`)
      .select('*')
      .eq('document_id', documentId)
      .single();

    let expiryRecord: DocumentExpiryRecord | null = null;
    if (expiryResult.data && !expiryResult.error) {
      expiryRecord = this.mapExpiryRow(expiryResult.data as ExpiryRow);
    }

    return Object.assign(
      {
        versions,
        linkages,
        approvals,
        ocrResults,
        signatures,
        expiryRecord,
      },
      document,
    );
  }

  /**
   * List documents linked to a specific entity with optional filters.
   */
  async listByEntity(
    entityType: string,
    entityId: string,
    filters?: { status?: string; documentType?: string },
  ): Promise<DocumentSummary[]> {
    const client = createAdminClient();

    let query = client
      .from(`${this.schema}.documents`)
      .select(
        'id, document_id, document_type, status, file_reference, file_hash, expiry_date, issue_date, created_at, updated_at, created_by',
      )
      .eq('linked_entity_type', entityType)
      .eq('linked_entity_id', entityId)
      .eq('is_deleted', false);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.documentType) {
      query = query.eq('document_type', filters.documentType);
    }

    const result = await query.order('created_at', { ascending: false });

    if (result.error) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, `Failed to list documents: ${result.error.message}`);
    }

    return ((result.data as DocumentSummaryRow[]) ?? []).map(r => this.mapDocumentSummary(r));
  }

  /**
   * List documents by status (admin use).
   */
  async listByStatus(status: string): Promise<DocumentSummary[]> {
    const client = createAdminClient();

    const result = await client
      .from(`${this.schema}.documents`)
      .select(
        'id, document_id, document_type, status, file_reference, file_hash, expiry_date, issue_date, created_at, updated_at, created_by',
      )
      .eq('status', status)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (result.error) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, `Failed to list documents by status: ${result.error.message}`);
    }

    return ((result.data as DocumentSummaryRow[]) ?? []).map(r => this.mapDocumentSummary(r));
  }

  /**
   * Transition document status through lifecycle states.
   */
  async updateStatus(documentId: string, newStatus: string, updatedBy: string): Promise<void> {
    const validStatuses = Object.values(DocumentStatus);
    if (!validStatuses.includes(newStatus as DocumentStatus)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Invalid document status: ${newStatus}. Valid values: ${validStatuses.join(', ')}`,
      );
    }

    const client = createAdminClient();
    const now = new Date().toISOString();

    const result = await client
      .from(`${this.schema}.documents`)
      .update({ status: newStatus as DocumentStatus, updated_at: now, updated_by: updatedBy })
      .eq('document_id', documentId)
      .eq('is_deleted', false)
      .select('*');

    if (result.error) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, `Failed to update document status: ${result.error.message}`);
    }

    if (!(result.data && result.data.length > 0)) {
      throw new NotFoundError('Document', documentId);
    }
  }

  /**
   * Soft delete a document: set is_deleted = true and status = ARCHIVED.
   */
  async delete(documentId: string, updatedBy: string): Promise<void> {
    const client = createAdminClient();
    const now = new Date().toISOString();

    const result = await client
      .from(`${this.schema}.documents`)
      .update({
        is_deleted: true,
        status: DocumentStatus.ARCHIVED,
        updated_at: now,
        updated_by: updatedBy,
      })
      .eq('document_id', documentId)
      .eq('is_deleted', false)
      .select('*');

    if (result.error) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, `Failed to delete document: ${result.error.message}`);
    }

    if (!(result.data && result.data.length > 0)) {
      throw new NotFoundError('Document', documentId);
    }
  }

  // ---- Version operations -----------------------------------------------

  /**
   * Create an immutable version snapshot of a document.
   */
  async createVersion(data: VersionCreateInput): Promise<DocumentVersion> {
    const client = createAdminClient();

    // Verify the document exists and is not deleted
    const docCheck = await client
      .from(`${this.schema}.documents`)
      .select('id, status, is_deleted')
      .eq('document_id', data.documentId)
      .single();

    if (docCheck.error) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, `Document lookup failed: ${docCheck.error.message}`);
    }

    if (!docCheck.data) {
      throw new NotFoundError('Document', data.documentId);
    }

    if (docCheck.data.is_deleted) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Cannot create version on deleted document');
    }

    // Get the next version number
    const maxVersionResult = await client
      .from(`${this.schema}.document_versions`)
      .select('version_number')
      .eq('document_id', data.documentId)
      .order('version_number', { ascending: false })
      .limit(1);

    const currentMax = (maxVersionResult.data?.[0] as { version_number: number } | undefined)?.version_number ?? 0;
    const nextVersion = Math.max(data.versionNumber, currentMax + 1);

    const contentData = JSON.stringify(data.data);

    const result = await client
      .from(`${this.schema}.document_versions`)
      .insert({
        document_id: data.documentId,
        version_number: nextVersion,
        content_data: contentData,
        content_change_summary: data.changeSummary,
        created_by: data.createdBy,
      })
      .select()
      .single();

    if (result.error) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Failed to create version: ${result.error.message}`,
        { documentId: data.documentId, versionNumber: nextVersion },
      );
    }

    return this.mapVersionRow(result.data as DocumentVersionRow);
  }

  /**
   * Get all versions for a document ordered by version number ASC.
   */
  async getVersions(documentId: string): Promise<DocumentVersion[]> {
    const client = createAdminClient();

    const result = await client
      .from(`${this.schema}.document_versions`)
      .select('*')
      .eq('document_id', documentId)
      .order('version_number', { ascending: true });

    if (result.error) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Failed to get versions: ${result.error.message}`,
        { documentId },
      );
    }

    return ((result.data as DocumentVersionRow[]) ?? []).map(r => this.mapVersionRow(r));
  }

  // ---- Approval operations ----------------------------------------------

  /**
   * Create a new approval record for a document.
   */
  async createApproval(record: ApprovalCreateInput): Promise<DocumentApprovalRecord> {
    const client = createAdminClient();
    const now = new Date().toISOString();

    const result = await client
      .from(`${this.schema}.document_approvals`)
      .insert({
        document_id: record.documentId,
        approval_id: crypto.randomUUID(),
        approver_role: record.approverRole,
        approval_status: 'PENDING',
        timestamp: now,
        comments: record.comments ?? null,
      })
      .select()
      .single();

    if (result.error) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Failed to create approval record: ${result.error.message}`,
        { documentId: record.documentId },
      );
    }

    return this.mapApprovalRow(result.data as DocumentApprovalRow);
  }

  /**
   * Update an approval record status.
   */
  async updateApproval(approvalId: string, status: 'APPROVED' | 'REJECTED', comments?: string): Promise<void> {
    const client = createAdminClient();
    const now = new Date().toISOString();

    const result = await client
      .from(`${this.schema}.document_approvals`)
      .update({
        approval_status: status,
        timestamp: now,
        comments: comments ?? null,
      })
      .eq('approval_id', approvalId)
      .eq('approval_status', 'PENDING')
      .select('*');

    if (result.error) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Failed to update approval: ${result.error.message}`,
        { approvalId },
      );
    }

    if (!(result.data && result.data.length > 0)) {
      throw new NotFoundError('Approval record', approvalId);
    }
  }

  // ---- Linkage operations -----------------------------------------------

  /**
   * Create a new document linkage.
   */
  async createLinkage(linkage: LinkageCreateInput): Promise<void> {
    const client = createAdminClient();

    const result = await client
      .from(`${this.schema}.document_linkages`)
      .insert({
        document_id: linkage.documentId,
        module_reference: linkage.moduleReference,
        entity_reference: linkage.entityReference,
        relationship_type: linkage.relationshipType,
      });

    if (result.error) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Failed to create linkage: ${result.error.message}`,
        { documentId: linkage.documentId },
      );
    }
  }

  /**
   * Get all linkages for a document.
   */
  async getLinkages(documentId: string): Promise<DocumentLinkageObject[]> {
    const client = createAdminClient();

    const result = await client
      .from(`${this.schema}.document_linkages`)
      .select('*')
      .eq('document_id', documentId);

    if (result.error) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Failed to get linkages: ${result.error.message}`,
        { documentId },
      );
    }

    return ((result.data as DocumentLinkageRow[]) ?? []).map(r => this.mapLinkageRow(r));
  }

  // ---- OCR operations ---------------------------------------------------

  /**
   * Create or update an OCR extraction result for a document.
   */
  async createOcrResult(data: OcrCreateInput): Promise<OcrExtractionResult> {
    const client = createAdminClient();
    const now = new Date().toISOString();

    const result = await client
      .from(`${this.schema}.ocr_results`)
      .insert({
        document_id: data.documentId,
        extraction_id: crypto.randomUUID(),
        extracted_fields: JSON.stringify(data.extractedFields),
        confidence_score: data.confidenceScore,
        field_confidence_scores: JSON.stringify(data.fieldConfidenceScores),
        user_reviewed: false,
        user_corrections: '{}',
        processed_at: now,
      })
      .select()
      .single();

    if (result.error) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Failed to create OCR result: ${result.error.message}`,
        { documentId: data.documentId },
      );
    }

    return this.mapOcrRow(result.data as OcrRow);
  }

  /**
   * Apply manual corrections to an OCR extraction.
   */
  async updateOcrCorrections(extractionId: string, corrections: Record<string, string>): Promise<void> {
    const client = createAdminClient();

    // Get existing OCR row
    const existing = await client
      .from(`${this.schema}.ocr_results`)
      .select('user_corrections, user_reviewed')
      .eq('extraction_id', extractionId)
      .single();

    if (existing.error) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `OCR lookup failed: ${existing.error.message}`,
        { extractionId },
      );
    }

    if (!existing.data) {
      throw new NotFoundError('OCR extraction', extractionId);
    }

    const currentCorrections = JSON.parse((existing.data as { user_corrections: string }).user_corrections || '{}');
    const mergedCorrections = { ...currentCorrections, ...corrections };

    const updateResult = await client
      .from(`${this.schema}.ocr_results`)
      .update({
        user_corrections: JSON.stringify(mergedCorrections),
        user_reviewed: true,
      })
      .eq('extraction_id', extractionId);

    if (updateResult.error) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Failed to update OCR corrections: ${updateResult.error.message}`,
        { extractionId },
      );
    }
  }

  // ---- Signature operations ---------------------------------------------

  /**
   * Create a digital signature record for a document.
   */
  async createSignature(data: SignatureCreateInput): Promise<DigitalSignatureRecord> {
    const client = createAdminClient();

    // Check for duplicate signature per §7.6
    const hasDuplicate = await this.checkDuplicateSignature(data.documentId, data.signerId);
    if (hasDuplicate) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `Duplicate signature found: signer ${data.signerId} already signed document ${data.documentId}`,
        { documentId: data.documentId, signerId: data.signerId },
      );
    }

    const result = await client
      .from(`${this.schema}.digital_signatures`)
      .insert({
        document_id: data.documentId,
        signature_id: crypto.randomUUID(),
        signer_id: data.signerId,
        signer_role: data.signerRole,
        signature_timestamp: new Date().toISOString(),
        signature_certificate: data.signatureCertificate,
        verification_method: data.verificationMethod,
        ip_address: data.ipAddress ?? null,
        user_agent: data.userAgent ?? null,
      })
      .select()
      .single();

    if (result.error) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Failed to create signature: ${result.error.message}`,
        { documentId: data.documentId },
      );
    }

    return this.mapSignatureRow(result.data as SignatureRow);
  }

  /**
   * Check if a signer has already signed a given document (§7.6).
   */
  async checkDuplicateSignature(documentId: string, signerId: string): Promise<boolean> {
    const client = createAdminClient();

    const result = await client
      .from(`${this.schema}.digital_signatures`)
      .select('signature_id')
      .eq('document_id', documentId)
      .eq('signer_id', signerId)
      .limit(1);

    if (result.error) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Signature check failed: ${result.error.message}`,
        { documentId, signerId },
      );
    }

    return (result.data?.length ?? 0) > 0;
  }

  // ---- Expiry operations ------------------------------------------------

  /**
   * Create an expiry tracking record for a document.
   */
  async createExpiryRecord(data: ExpiryCreateInput): Promise<void> {
    const client = createAdminClient();

    const result = await client
      .from(`${this.schema}.document_expiry_records`)
      .insert({
        document_id: data.documentId,
        document_type: data.documentType,
        linked_entity_id: data.linkedEntityId,
        issue_date: data.issueDate,
        expiry_date: data.expiryDate,
        renewal_status: RenewalStatus.ACTIVE,
        operational_impact: data.operationalImpact,
      });

    if (result.error) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Failed to create expiry record: ${result.error.message}`,
        { documentId: data.documentId },
      );
    }
  }

  /**
   * Update the renewal status of an expiry record and set operational impact.
   */
  async updateExpiryStatus(
    expiryRecordId: string,
    newStatus: RenewalStatus,
    operationalImpact: OperationalImpact,
  ): Promise<void> {
    const client = createAdminClient();

    const result = await client
      .from(`${this.schema}.document_expiry_records`)
      .update({
        renewal_status: newStatus,
        operational_impact: operationalImpact,
      })
      .eq('expiry_record_id', expiryRecordId)
      .select('*');

    if (result.error) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Failed to update expiry status: ${result.error.message}`,
        { expiryRecordId },
      );
    }

    if (!(result.data && result.data.length > 0)) {
      throw new NotFoundError('Expiry record', expiryRecordId);
    }
  }

  /**
   * Find documents expiring within the given threshold days (for cron job).
   */
  async getExpiringDocuments(daysThreshold: number): Promise<DocumentExpiryRecord[]> {
    const client = createAdminClient();
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    const result = await client
      .from(`${this.schema}.document_expiry_records`)
      .select('*')
      .in('renewal_status', [RenewalStatus.ACTIVE, RenewalStatus.EXPIRING])
      .lte('expiry_date', thresholdDate.toISOString())
      .gte('expiry_date', new Date().toISOString());

    if (result.error) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Failed to get expiring documents: ${result.error.message}`,
        { daysThreshold },
      );
    }

    return ((result.data as ExpiryRow[]) ?? []).map(r => this.mapExpiryRow(r));
  }
}
