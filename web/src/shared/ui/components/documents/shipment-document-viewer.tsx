'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../card';
import { Badge } from '../badge';
import { Table, Column } from '../table';
import { Spinner } from '../spinner';
import { Skeleton } from '../skeleton';
import { cn } from '@/shared/ui/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocumentStatus =
  | 'ACTIVE'
  | 'UPLOADED'
  | 'VALIDATED'
  | 'SIGNED'
  | 'APPROVED'
  | 'EXPIRING'
  | 'EXPIRED'
  | 'ARCHIVED'
  | 'REJECTED';

export type EntityType = 'shipment' | 'booking' | 'contract';

export interface ShipmentDocumentViewerProps {
  entityType: EntityType;
  entityId: string;
  openUploadPanel?: () => void;
  className?: string;
}

interface DocumentVersion {
  id: string;
  versionNumber: number;
  fileName: string;
  fileSize: number | null;
  uploadedAt: string;
  uploadedBy: string | null;
  comment: string | null;
  [key: string]: unknown;
}

interface ApprovalRecord {
  id: string;
  approverName: string;
  approverEmail: string | null;
  action: string;
  createdAt: string;
  comment: string | null;
  [key: string]: unknown;
}

interface OcrExtraction {
  id: string;
  rawText: string | null;
  extractedFields: Record<string, string> | null;
  processedAt: string;
  confidence: number | null;
  [key: string]: unknown;
}

interface SignatureInfo {
  id: string;
  signerName: string;
  signerEmail: string | null;
  signedAt: string;
  ipAddress: string | null;
  status: 'signed' | 'pending' | 'declined';
  method: string | null;
  [key: string]: unknown;
}

interface ExpiryRecord {
  id: string;
  expiresAt: string;
  renewedAt: string | null;
  renewalNote: string | null;
  [key: string]: unknown;
}

interface Document {
  id: string;
  entityType: EntityType;
  entityId: string;
  documentType: string;
  fileName: string;
  reference: string | null;
  status: DocumentStatus;
  fileSize: number | null;
  mimeType: string | null;
  storageKey: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedBy: string | null;
  description: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  versions: DocumentVersion[];
  approvals: ApprovalRecord[];
  ocrExtractions: OcrExtraction[];
  signatures: SignatureInfo[];
  expiryRecords: ExpiryRecord[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Constants — icons & colour maps
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<string, string> = {
  CONTRACT: '📄',
  POD: '✅',
  BILL_OF_LADING: '🚢',
  INVOICE: '💰',
  INSURANCE_CERTIFICATE: '🛡️',
  DRIVER_LICENSE: '👤',
  VEHICLE_REGISTRATION: '🚗',
  CUSTOMS_DOCUMENT: '🏛️',
};

const STATUS_VARIANTS: Record<DocumentStatus, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  ACTIVE: 'success',
  UPLOADED: 'info',
  VALIDATED: 'info',
  SIGNED: 'neutral',
  APPROVED: 'success',
  EXPIRING: 'warning',
  EXPIRED: 'danger',
  ARCHIVED: 'neutral',
  REJECTED: 'danger',
};

const FILTER_TABS: { label: string; status: DocumentStatus | 'ALL' }[] = [
  { label: 'All', status: 'ALL' },
  { label: 'Active', status: 'ACTIVE' },
  { label: 'Approved', status: 'APPROVED' },
  { label: 'Expired', status: 'EXPIRED' },
  { label: 'Archived', status: 'ARCHIVED' },
];

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const DATETIME_FMT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === null || bytes === undefined) return '\u2014';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function getFilteredDocuments(docs: Document[], filter: DocumentStatus | 'ALL'): Document[] {
  if (filter === 'ALL') return docs;
  return docs.filter((d) => d.status === filter);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen,
}: {
  title: string;
  icon?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
          'bg-zinc-50 dark:bg-zinc-800'
        )}
      >
        <span className="inline-flex items-center gap-2">
          {icon && <span>{icon}</span>}
          {title}
        </span>
        <span className="text-xs text-zinc-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="px-4 py-3 bg-white dark:bg-zinc-900">{children}</div>}
    </div>
  );
}

function MetadataGrid({ document }: { document: Document }) {
  const rows: { label: string; value: string }[] = [
    { label: 'ID', value: document.id },
    { label: 'Type', value: document.documentType },
    { label: 'Status', value: document.status },
    { label: 'File Name', value: document.fileName },
    { label: 'Reference', value: document.reference || '\u2014' },
    { label: 'File Size', value: document.fileSize != null ? formatBytes(document.fileSize) : '\u2014' },
    { label: 'MIME Type', value: document.mimeType || '\u2014' },
    { label: 'Uploaded By', value: document.uploadedBy || '\u2014' },
    { label: 'Created', value: DATE_FMT.format(new Date(document.createdAt)) },
    { label: 'Updated', value: DATE_FMT.format(new Date(document.updatedAt)) },
    { label: 'Description', value: document.description || '\u2014' },
    { label: 'Tags', value: document.tags?.length ? document.tags.join(', ') : '\u2014' },
  ];

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex flex-col">
          <dt className="text-xs uppercase tracking-wider text-zinc-400 mb-0.5">{label}</dt>
          <dd className="font-medium text-zinc-800 dark:text-zinc-100 break-all">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ShipmentDocumentViewer({
  entityType,
  entityId,
  openUploadPanel,
  className,
}: ShipmentDocumentViewerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [filter, setFilter] = useState<DocumentStatus | 'ALL'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/documents?linkedEntityType=${encodeURIComponent(entityType)}&linkedEntityId=${encodeURIComponent(entityId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: Document[] = await res.json();
        if (!cancelled) setDocuments(json);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load documents');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  const filteredDocs = getFilteredDocuments(documents, filter);

  // Derive selected document; automatically invalid if entity changed
  const selectedDoc = selectedDocId
    ? documents.find((d) => d.id === selectedDocId && d.entityId === entityId) ?? null
    : null;

  // ------------------------------------------------------------------
  // Table columns for the list view
  // ------------------------------------------------------------------
  const listColumns: Column<Record<string, unknown>>[] = [
    {
      key: 'typeIcon',
      header: '',
      width: '3rem',
      render: (_v, r) => { const row = r as Document; return <span className="text-base">        {TYPE_ICONS[row.documentType] || '📄'}</span>; },
    },
    {
      key: 'status',
      header: 'Status',
      render: (_v, r) => { const row = r as Document; return (<Badge variant={STATUS_VARIANTS[row.status]} size="sm">{row.status}</Badge>); },
    },
    {
      key: 'fileName',
      header: 'Document',
      render: (_v, r) => { const row = r as Document; return (<div className="flex flex-col"><span className="font-medium truncate max-w-[200px]">{row.fileName}</span>{row.reference && (<span className="text-xs text-zinc-400">{row.reference}</span>)}</div>); },
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (_v, r) => { const row = r as Document; return DATE_FMT.format(new Date(row.createdAt)); },
    },
    {
      key: 'actions',
      header: '',
      width: '6rem',
      render: (_v, r) => { const row = r as Document; return (
        <button
              onClick={() => setSelectedDocId(row.id)}
          className="rounded-md border border-zinc-200 px-2 py-1 text-xs transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          View
        </button>
      ); },
    },
  ];

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex gap-2">
            {FILTER_TABS.map((tab) => (
              <Skeleton key={tab.label} className="h-7 w-20" />
            ))}
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-sm text-red-500">
          <svg className="mb-2 h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          {error}
        </CardContent>
      </Card>
    );
  }

  // Detail panel — selected document
  if (selectedDoc) {
    return (
      <Card className={cn('overflow-auto', className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                  onClick={() => setSelectedDocId(null)}
                className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                \u2190 Back
              </button>
              <span className="text-lg">{TYPE_ICONS[selectedDoc.documentType] || '📄'}</span>
              <CardTitle className="truncate">{selectedDoc.fileName}</CardTitle>
            </div>
            <Badge variant={STATUS_VARIANTS[selectedDoc.status]}>{selectedDoc.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Full metadata */}
          <section>
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">Document Details</h4>
            <MetadataGrid document={selectedDoc} />
          </section>

          {/* Storage link */}
          {selectedDoc.storageKey && (
            <section>
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">File Access</h4>
              <a
                href={`/api/documents/${selectedDoc.id}/download`}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {'📥'} Download File
              </a>
              {selectedDoc.mimeType?.startsWith('image/') && (
                <>
                  {' '}
                  <a
                    href={`/api/documents/${selectedDoc.id}/preview`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    {'🖼️'} Preview
                  </a>
                </>
              )}
            </section>
          )}

          {/* Version history */}
          {selectedDoc.versions.length > 0 && (
            <CollapsibleSection title={`Versions (${selectedDoc.versions.length})`} icon="\u{1F503}" defaultOpen>
              <Table
                columns={[
                  { key: 'versionNumber', header: 'Ver #', render: (_v, r) => { const row = r as DocumentVersion; return `v${row.versionNumber}`; } },
                  { key: 'fileName', header: 'File Name' },
                  { key: 'fileSize', header: 'Size', render: (_v, r) => { const row = r as DocumentVersion; return formatBytes(row.fileSize ?? 0); } },
                  { key: 'uploadedAt', header: 'Uploaded', render: (_v, r) => { const row = r as DocumentVersion; return DATETIME_FMT.format(new Date(row.uploadedAt)); } },
                  { key: 'uploadedBy', header: 'Uploaded By' },
                  { key: 'comment', header: 'Comment' },
                ]}
                data={selectedDoc.versions}
                emptyMessage="No version history available."
              />
            </CollapsibleSection>
          )}

          {/* Approval records */}
          {selectedDoc.approvals.length > 0 && (
            <CollapsibleSection title={`Approvals (${selectedDoc.approvals.length})`} icon="\u{2705}" defaultOpen>
              <Table
                columns={[
                  { key: 'approverName', header: 'Approver' },
                  { key: 'action', header: 'Action' },
                  { key: 'createdAt', header: 'Date', render: (_v, r) => { const row = r as ApprovalRecord; return DATETIME_FMT.format(new Date(row.createdAt)); } },
                  { key: 'comment', header: 'Comment' },
                ]}
                data={selectedDoc.approvals}
                emptyMessage="No approval records."
              />
            </CollapsibleSection>
          )}

          {/* OCR extractions */}
          {selectedDoc.ocrExtractions.length > 0 && (
            <CollapsibleSection title="OCR Results" icon="\u{1F50E}" defaultOpen>
              <div className="space-y-4">
                {selectedDoc.ocrExtractions.map((ocr) => (
                  <div key={ocr.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                    <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                      <span>{DATETIME_FMT.format(new Date(ocr.processedAt))}</span>
                      {ocr.confidence !== null && (
                        <span>Confidence: {(ocr.confidence * 100).toFixed(1)}%</span>
                      )}
                    </div>
                    {ocr.extractedFields && Object.keys(ocr.extractedFields).length > 0 && (
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        {Object.entries(ocr.extractedFields).map(([key, val]) => (
                          <React.Fragment key={key}>
                            <dt className="text-xs uppercase tracking-wider text-zinc-400">{key}</dt>
                            <dd className="font-medium break-all">{String(val)}</dd>
                          </React.Fragment>
                        ))}
                      </dl>
                    )}
                    {ocr.rawText && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-zinc-400 underline">Raw text</summary>
                        <pre className="mt-1 max-h-40 overflow-auto rounded bg-zinc-50 p-2 text-xs dark:bg-zinc-800">{ocr.rawText}</pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Digital signatures */}
          {selectedDoc.signatures.length > 0 && (
            <CollapsibleSection title={`Signatures (${selectedDoc.signatures.length})`} icon="\u{2712}\u{FE0F}" defaultOpen>
              <Table
                columns={[
                  { key: 'signerName', header: 'Signer' },
                  { key: 'status', header: 'Status', render: (_v, r) => { const row = r as SignatureInfo; return (
                    <Badge
                      variant={row.status === 'signed' ? 'success' : row.status === 'declined' ? 'danger' : 'warning'}
                      size="sm"
                    >
                      {row.status}
                    </Badge>
                  ); } },
                  { key: 'signedAt', header: 'Signed At', render: (_v, r) => { const row = r as SignatureInfo; return DATETIME_FMT.format(new Date(row.signedAt)); } },
                  { key: 'ipAddress', header: 'IP Address' },
                  { key: 'method', header: 'Method' },
                ]}
                data={selectedDoc.signatures}
                emptyMessage="No signature records."
              />
            </CollapsibleSection>
          )}

          {/* Expiry records */}
          {selectedDoc.expiryRecords.length > 0 && (
            <CollapsibleSection title="Expiry Record" icon="\u{1F4C5}">
              <Table
                columns={[
                  { key: 'expiresAt', header: 'Expires', render: (_v, r) => { const row = r as ExpiryRecord; return DATETIME_FMT.format(new Date(row.expiresAt)); } },
                  { key: 'renewedAt', header: 'Renewed', render: (_v, r) => { const row = r as ExpiryRecord; return row.renewedAt ? DATETIME_FMT.format(new Date(row.renewedAt)) : '\u2014'; } },
                  { key: 'renewalNote', header: 'Note' },
                ]}
                data={selectedDoc.expiryRecords}
                emptyMessage="No expiry record."
              />
            </CollapsibleSection>
          )}
        </CardContent>
      </Card>
    );
  }

  // ------------------------------------------------------------------
  // List view
  // ------------------------------------------------------------------

  return (
    <Card className={cn('overflow-visible', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Documents</CardTitle>
          {openUploadPanel && (
            <button
              onClick={openUploadPanel}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
{'📤'} Upload
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn('p-0')}>
        {/* Filter tabs */}
        <div className="flex gap-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-700 overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => setFilter(tab.status)}
              className={cn(
                'rounded-full px-3 py-1 text-sm transition-colors whitespace-nowrap',
                filter === tab.status
                  ? 'bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
              )}
            >
              {tab.label}
              <span className="ml-1 text-xs opacity-60">
                ({tab.status === 'ALL' ? documents.length : documents.filter((d) => d.status === tab.status).length})
              </span>
            </button>
          ))}
        </div>

        {/* Document table */}
        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-sm text-zinc-400">
            <svg className="mb-3 h-14 w-14 text-zinc-200 dark:text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Spinner className="h-4 w-4" />
                <span>Loading documents…</span>
              </div>
            ) : (
              <span>No documents found for this entity.</span>
            )}
          </div>
        ) : (
          <Table
            columns={listColumns}
            data={filteredDocs}
            emptyMessage="No documents match the selected filter."
            striped
            hoverable
          />
        )}
      </CardContent>
    </Card>
  );
}
