// NexCargo MOD-004 — Document Validation Services Tests
// Wave 2 — Stage 2B, Increment 2 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)

import { describe, it, expect } from 'vitest';
import { validateDocumentUpload, validateDocumentVersioning, assertImmutableDocumentProtected, validateDocumentLinkage, validateOcrExtraction, validateDigitalSignature, validateDocumentExpiry, assertValidNotificationSchedule, validateAcceptableFormat } from '../domain/services/document-services';
import { DocumentStatus, RelationshipType, SignatureVerificationMethod } from '../domain/enums';

describe('MOD-004 Document Upload Validation', () => {
  const validInput = {
    documentId: 'doc-001',
    documentType: 'CONTRACT' as const,
    linkedEntityType: 'contract' as const,
    linkedEntityId: 'contract-abc',
    fileReference: 's3://encrypted-docs/contract.pdf',
    fileHash: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
  };

  it('accepts valid document upload with all required fields', () => {
    expect(() => validateDocumentUpload(validInput)).not.toThrow();
  });

  it('rejects empty documentId', () => {
    expect(() => validateDocumentUpload({ ...validInput, documentId: '' })).toThrow(/documentId is required/);
  });

  it('rejects whitespace-only documentId', () => {
    expect(() => validateDocumentUpload({ ...validInput, documentId: '   ' })).toThrow(/documentId is required/);
  });

  it('rejects missing linkedEntityId', () => {
    expect(() => validateDocumentUpload({ ...validInput, linkedEntityId: '' })).toThrow(/linkedEntityId is required/);
  });

  it('rejects missing fileReference (pointer to encrypted storage)', () => {
    expect(() => validateDocumentUpload({ ...validInput, fileReference: '' })).toThrow(/fileReference is required/);
  });

  it('rejects missing fileHash (integrity checksum)', () => {
    expect(() => validateDocumentUpload({ ...validInput, fileHash: '' })).toThrow(/fileHash is required/);
  });

  it('rejects fileHash exceeding maximum length', () => {
    expect(() => validateDocumentUpload({
      ...validInput,
      fileHash: 'a'.repeat(257),
    })).toThrow(/must not exceed 256 characters/);
  });

  it('accepts valid SHA-256 hash at exactly 256 characters', () => {
    expect(() => validateDocumentUpload({
      ...validInput,
      fileHash: 'a'.repeat(256),
    })).not.toThrow();
  });
});

describe('MOD-004 Document Versioning Validation', () => {
  it('accepts valid version increment (current=1, new=2)', () => {
    const result = validateDocumentVersioning({
      currentVersion: 1,
      proposedNewVersion: 2,
      documentStatus: DocumentStatus.UPLOADED,
      isSignedOrApproved: false,
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects version number not greater than current', () => {
    const result = validateDocumentVersioning({
      currentVersion: 3,
      proposedNewVersion: 3,
      documentStatus: DocumentStatus.ACTIVE,
      isSignedOrApproved: false,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('greater than'))).toBe(true);
  });

  it('rejects decreasing version number', () => {
    const result = validateDocumentVersioning({
      currentVersion: 3,
      proposedNewVersion: 1,
      documentStatus: DocumentStatus.ACTIVE,
      isSignedOrApproved: false,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('greater than'))).toBe(true);
  });

  it('rejects modification of signed document', () => {
    const result = validateDocumentVersioning({
      currentVersion: 2,
      proposedNewVersion: 3,
      documentStatus: DocumentStatus.SIGNED,
      isSignedOrApproved: true,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('immutable') || e.includes('approved'))).toBe(true);
  });

  it('rejects modification of approved document', () => {
    const result = validateDocumentVersioning({
      currentVersion: 5,
      proposedNewVersion: 6,
      documentStatus: DocumentStatus.APPROVED,
      isSignedOrApproved: true,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('immutable') || e.includes('approved'))).toBe(true);
  });

  it('rejects version exceeding maximum', () => {
    const result = validateDocumentVersioning({
      currentVersion: 99,
      proposedNewVersion: 101,
      documentStatus: DocumentStatus.ACTIVE,
      isSignedOrApproved: false,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('maximum'))).toBe(true);
  });

  it('accepts version just below maximum (99 -> 100)', () => {
    const result = validateDocumentVersioning({
      currentVersion: 99,
      proposedNewVersion: 100,
      documentStatus: DocumentStatus.ACTIVE,
      isSignedOrApproved: false,
    });
    expect(result.isValid).toBe(true);
  });
});

describe('MOD-004 Immutable Document Protection', () => {
  it('throws when attempting action on SIGNED document', () => {
    expect(() => assertImmutableDocumentProtected(DocumentStatus.SIGNED, 'UPDATE_METADATA')).toThrow(/immutable/);
  });

  it('throws when attempting action on APPROVED document', () => {
    expect(() => assertImmutableDocumentProtected(DocumentStatus.APPROVED, 'MODIFY_CONTENT')).toThrow(/immutable/);
  });

  it('throws when attempting action on ARCHIVED document', () => {
    expect(() => assertImmutableDocumentProtected(DocumentStatus.ARCHIVED, 'DELETE')).toThrow(/immutable/);
  });

  it('does NOT throw for UPLOADED document', () => {
    expect(() => assertImmutableDocumentProtected(DocumentStatus.UPLOADED, 'MODIFY_CONTENT')).not.toThrow();
  });

  it('does NOT throw for ACTIVE document', () => {
    expect(() => assertImmutableDocumentProtected(DocumentStatus.ACTIVE, 'MODIFY_CONTENT')).not.toThrow();
  });

  it('includes specific status and action in error message', () => {
    try {
      assertImmutableDocumentProtected(DocumentStatus.SIGNED, 'ARCHIVE');
    } catch (e) {
      const err = e as Error;
      expect(err.message).toContain('SIGNED');
      expect(err.message).toContain('ARCHIVE');
    }
  });
});

describe('MOD-004 Document Linkage Validation', () => {
  const validLinkage = {
    documentId: 'doc-001',
    entityReference: 'contract-abc',
    moduleReference: 'MOD-002',
    relationshipType: RelationshipType.SUPPORTS,
  };

  it('accepts valid document linkage with all required fields', () => {
    const result = validateDocumentLinkage(validLinkage);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing entityReference (orphan prevention)', () => {
    const result = validateDocumentLinkage({ ...validLinkage, entityReference: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('entityReference'))).toBe(true);
    expect(result.errors.some(e => e.includes('at least one system entity'))).toBe(true);
  });

  it('rejects missing moduleReference', () => {
    const result = validateDocumentLinkage({ ...validLinkage, moduleReference: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('moduleReference'))).toBe(true);
  });

  it('rejects invalid moduleReference format', () => {
    const result = validateDocumentLinkage({ ...validLinkage, moduleReference: 'MOD-INVALID' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('MOD-XXX'))).toBe(true);
  });

  it('rejects missing relationshipType', () => {
    const result = validateDocumentLinkage({ ...validLinkage, relationshipType: undefined });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('relationshipType'))).toBe(true);
  });

  it('accepts valid module reference MOD-001 through MOD-018', () => {
    for (let modNum = 1; modNum <= 18; modNum++) {
      const moduleRef = `MOD-${String(modNum).padStart(3, '0')}`;
      const result = validateDocumentLinkage({ ...validLinkage, moduleReference: moduleRef });
      expect(result.isValid).toBe(true);
    }
  });

  it('rejects module reference outside range (MOD-019)', () => {
    const result = validateDocumentLinkage({ ...validLinkage, moduleReference: 'MOD-019' });
    expect(result.isValid).toBe(false);
  });

  it('supports all four relationship types', () => {
    const types = [RelationshipType.SUPPORTS, RelationshipType.DERIVES, RelationshipType.VERIFIES, RelationshipType.VALIDATES] as const;
    for (const type of types) {
      const result = validateDocumentLinkage({ ...validLinkage, relationshipType: type });
      expect(result.isValid).toBe(true);
    }
  });
});

describe('MOD-004 OCR Extraction Validation', () => {
  it('accepts valid OCR extraction with high confidence', () => {
    const result = validateOcrExtraction({
      documentId: 'doc-001',
      confidenceScore: 92,
      extractedFieldsCount: 8,
      hasUserCorrections: false,
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts OCR extraction with moderate confidence', () => {
    const result = validateOcrExtraction({
      documentId: 'doc-001',
      confidenceScore: 55,
      extractedFieldsCount: 3,
      hasUserCorrections: false,
    });
    expect(result.isValid).toBe(true);
  });

  it('accepts OCR extraction with user corrections on high-confidence data', () => {
    const result = validateOcrExtraction({
      documentId: 'doc-001',
      confidenceScore: 80,
      extractedFieldsCount: 5,
      hasUserCorrections: true,
    });
    expect(result.isValid).toBe(true);
  });

  it('rejects missing documentId', () => {
    const result = validateOcrExtraction({
      documentId: '',
      confidenceScore: 85,
      extractedFieldsCount: 4,
      hasUserCorrections: false,
    });
    expect(result.isValid).toBe(false);
  });

  it('rejects confidence score below zero', () => {
    const result = validateOcrExtraction({
      documentId: 'doc-001',
      confidenceScore: -5,
      extractedFieldsCount: 4,
      hasUserCorrections: false,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('between 0 and 100'))).toBe(true);
  });

  it('rejects confidence score above 100', () => {
    const result = validateOcrExtraction({
      documentId: 'doc-001',
      confidenceScore: 105,
      extractedFieldsCount: 4,
      hasUserCorrections: false,
    });
    expect(result.isValid).toBe(false);
  });

  it('rejects zero extracted fields', () => {
    const result = validateOcrExtraction({
      documentId: 'doc-001',
      confidenceScore: 85,
      extractedFieldsCount: 0,
      hasUserCorrections: false,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('At least one field'))).toBe(true);
  });
});

describe('MOD-004 Digital Signature Validation', () => {
  const validSignature = {
    documentId: 'doc-001',
    signerId: 'user-sherif-001',
    signerRole: 'SHIPPER' as const,
    signatureCertificate: 'CA-ROOT-2026-X509',
    verificationMethod: SignatureVerificationMethod.DIGITAL_CERTIFICATE,
    previousSignatures: 0,
  };

  it('accepts valid digital signature with identity verified', () => {
    const result = validateDigitalSignature(validSignature);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing signerId (identity must be verified before signature)', () => {
    const result = validateDigitalSignature({ ...validSignature, signerId: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('signerId is required'))).toBe(true);
  });

  it('rejects missing signerRole', () => {
    const result = validateDigitalSignature({ ...validSignature, signerRole: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing signatureCertificate (must be retained for verification)', () => {
    const result = validateDigitalSignature({ ...validSignature, signatureCertificate: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('signatureCertificate is required'))).toBe(true);
  });

  it('rejects missing verificationMethod', () => {
    const baseSig = { ...validSignature };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { verificationMethod, ...baseWithoutVM } = baseSig;
    const result = validateDigitalSignature({ ...baseWithoutVM, verificationMethod: undefined as unknown as SignatureVerificationMethod });
    expect(result.isValid).toBe(false);
  });

  it('rejects duplicate signatures (previousSignatures > 0)', () => {
    const result = validateDigitalSignature({ ...validSignature, previousSignatures: 1 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Duplicate signature'))).toBe(true);
  });

  it('accepts valid BIOMETRIC verification method', () => {
    const result = validateDigitalSignature({ ...validSignature, verificationMethod: SignatureVerificationMethod.BIOMETRIC });
    expect(result.isValid).toBe(true);
  });

  it('accepts valid OTP verification method', () => {
    const result = validateDigitalSignature({ ...validSignature, verificationMethod: SignatureVerificationMethod.OTP });
    expect(result.isValid).toBe(true);
  });

  it('accepts valid PIN verification method', () => {
    const result = validateDigitalSignature({ ...validSignature, verificationMethod: SignatureVerificationMethod.PIN });
    expect(result.isValid).toBe(true);
  });
});

describe('MOD-004 Document Expiry Validation', () => {
  const validExpiry = {
    documentId: 'doc-001',
    hasValidityPeriod: true,
    issueDate: new Date('2025-01-01'),
    expiryDate: new Date('2026-12-31'),
    renewalStatus: 'ACTIVE',
    operationalImpact: 'NONE',
  };

  it('accepts valid expiry record with all dates present', () => {
    const result = validateDocumentExpiry(validExpiry);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts document without validity period', () => {
    const result = validateDocumentExpiry({ ...validExpiry, hasValidityPeriod: false, issueDate: undefined, expiryDate: undefined });
    expect(result.isValid).toBe(true);
  });

  it('rejects missing issueDate for documents with validity period', () => {
    const result = validateDocumentExpiry({ ...validExpiry, issueDate: undefined });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('issueDate is required'))).toBe(true);
  });

  it('rejects missing expiryDate for documents with validity period', () => {
    const result = validateDocumentExpiry({ ...validExpiry, expiryDate: undefined });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('expiryDate is required'))).toBe(true);
  });

  it('rejects expiryDate before issueDate', () => {
    const result = validateDocumentExpiry({
      ...validExpiry,
      issueDate: new Date('2026-12-31'),
      expiryDate: new Date('2025-01-01'),
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('after issueDate'))).toBe(true);
  });

  it('rejects invalid renewalStatus', () => {
    const result = validateDocumentExpiry({ ...validExpiry, renewalStatus: 'INVALID_STATUS' });
    expect(result.isValid).toBe(false);
  });

  it('accepts all valid renewal statuses', () => {
    const statuses = ['ACTIVE', 'EXPIRING', 'EXPIRED', 'RENEWED', 'RENEWAL_PENDING'];
    for (const status of statuses) {
      const result = validateDocumentExpiry({ ...validExpiry, renewalStatus: status });
      expect(result.isValid).toBe(true);
    }
  });

  it('rejects invalid operationalImpact', () => {
    const result = validateDocumentExpiry({ ...validExpiry, operationalImpact: 'UNKNOWN' });
    expect(result.isValid).toBe(false);
  });

  it('accepts all valid operational impacts', () => {
    const impacts = ['NONE', 'WARNING', 'SUSPENDED', 'BLOCKED'];
    for (const impact of impacts) {
      const result = validateDocumentExpiry({ ...validExpiry, operationalImpact: impact });
      expect(result.isValid).toBe(true);
    }
  });

  it('rejects missing documentId', () => {
    const result = validateDocumentExpiry({ ...validExpiry, documentId: '' });
    expect(result.isValid).toBe(false);
  });
});

describe('MOD-004 Notification Schedule Validation', () => {
  it('accepts default schedule [90, 60, 30, 7, 1]', () => {
    expect(assertValidNotificationSchedule([90, 60, 30, 7, 1])).toBe(true);
  });

  it('accepts custom descending schedule', () => {
    expect(assertValidNotificationSchedule([180, 120, 60, 30])).toBe(true);
  });

  it('rejects ascending schedule', () => {
    expect(assertValidNotificationSchedule([1, 7, 30, 60, 90])).toBe(false);
  });

  it('rejects empty schedule', () => {
    expect(assertValidNotificationSchedule([])).toBe(false);
  });

  it('rejects non-array input', () => {
    expect(assertValidNotificationSchedule(-1 as unknown as number[])).toBe(false);
  });

  it('rejects negative day values', () => {
    expect(assertValidNotificationSchedule([-1, 30, 60])).toBe(false);
  });

  it('rejects day values exceeding 365', () => {
    expect(assertValidNotificationSchedule([400, 200, 100])).toBe(false);
  });

  it('rejects single-element array with invalid value', () => {
    expect(assertValidNotificationSchedule([0])).toBe(false);
  });

  it('accepts minimum valid single day value', () => {
    expect(assertValidNotificationSchedule([1])).toBe(true);
  });
});

describe('MOD-004 Acceptable Format Validation', () => {
  it('accepts PDF format', () => {
    const result = validateAcceptableFormat('.pdf');
    expect(result.isValid).toBe(true);
  });

  it('accepts DOCX format', () => {
    const result = validateAcceptableFormat('.docx');
    expect(result.isValid).toBe(true);
  });

  it('accepts image formats (JPG, PNG, TIFF)', () => {
    for (const fmt of ['jpg', 'png', 'tiff']) {
      const result = validateAcceptableFormat(fmt);
      expect(result.isValid).toBe(true);
    }
  });

  it('rejects unsupported format', () => {
    const result = validateAcceptableFormat('.exe');
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Unsupported file format'))).toBe(true);
  });

  it('rejects raw document type as format', () => {
    const result = validateAcceptableFormat('DOCUMENT');
    expect(result.isValid).toBe(false);
  });
});
