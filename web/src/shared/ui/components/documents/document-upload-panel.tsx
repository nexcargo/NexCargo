// NexCargo — Document Upload Panel
// MOD-004: Document management UI primitive
// C6-II Shared UI Layer

'use client';

import React, { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { cn } from '@/shared/ui/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/components/card';
import { Button } from '@/shared/ui/components/button';
import { Input } from '@/shared/ui/components/form-controls';
import { Spinner } from '@/shared/ui/components/spinner';
import { useToast } from '@/shared/ui/components/toast';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'jpg', 'jpeg', 'png', 'tiff', 'tif'];

export const DOCUMENT_TYPES = [
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'POD', label: 'Proof of Delivery' },
  { value: 'BILL_OF_LADING', label: 'Bill of Lading' },
  { value: 'CUSTOMS_DOCUMENT', label: 'Customs Document' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'VEHICLE_REGISTRATION', label: 'Vehicle Registration' },
  { value: 'DRIVER_LICENSE', label: 'Driver License' },
  { value: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate' },
  { value: 'OPERATING_LICENSE', label: 'Operating License' },
  { value: 'COMPLIANCE_CERTIFICATE', label: 'Compliance Certificate' },
] as const;

const EXPIRY_DOCUMENT_TYPES = new Set([
  'VEHICLE_REGISTRATION',
  'DRIVER_LICENSE',
  'INSURANCE_CERTIFICATE',
  'OPERATING_LICENSE',
  'COMPLIANCE_CERTIFICATE',
]);

const ENTITY_LABELS: Record<string, string> = {
  shipment: 'Shipment',
  booking: 'Booking',
  contract: 'Contract',
  user: 'User',
  vehicle: 'Vehicle',
  driver: 'Driver',
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface DocumentUploadPanelProps {
  linkedEntityType: 'shipment' | 'booking' | 'contract' | 'user' | 'vehicle' | 'driver';
  linkedEntityId: string;
  onSuccess?: (documentId: string) => void;
  onClose?: () => void;
  className?: string;
}

interface FileState {
  file: File;
  previewUrl: string | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DocumentUploadPanel({
  linkedEntityType,
  linkedEntityId,
  onSuccess,
  onClose,
  className,
}: DocumentUploadPanelProps) {
  const { addToast } = useToast();

  const [documentType, setDocumentType] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [fileState, setFileState] = useState<FileState | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const needsExpiryFields = documentType ? EXPIRY_DOCUMENT_TYPES.has(documentType) : false;

  const validateFile = useCallback((file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ACCEPTED_EXTENSIONS.includes(ext)) {
      return 'Unsupported format. Accepted: PDF, DOCX, XLSX, JPG, PNG, TIFF';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File exceeds maximum size of 25MB';
    }
    return null;
  }, []);

  const handleFiles = useCallback((files: FileList | File[]) => {
    setError(null);
    const file = files[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setFileState({ file, previewUrl });
  }, [validateFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const { files } = e.dataTransfer;
    if (files && files.length > 0) handleFiles(files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (files && files.length > 0) handleFiles(files);
  }, [handleFiles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fileState) {
      setError('Please select a file to upload.');
      return;
    }
    if (!documentType) {
      setError('Please select a document type.');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', fileState.file);
      formData.append('documentType', documentType);
      formData.append('linkedEntityType', linkedEntityType);
      formData.append('linkedEntityId', linkedEntityId);
      if (issueDate) formData.append('issueDate', issueDate);
      if (expiryDate) formData.append('expiryDate', expiryDate);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        if (text.includes('Unsupported format') || text.includes('unsupported')) {
          throw new Error('Unsupported format. Accepted: PDF, DOCX, XLSX, JPG, PNG, TIFF');
        }
        if (text.includes('maximum size') || text.includes('too large') || text.includes('exceeds')) {
          throw new Error('File exceeds maximum size of 25MB');
        }
        throw new Error(text || `Upload failed (${response.status})`);
      }

      const data = await response.json();
      const documentId = data?.id ?? data?.documentId ?? '';

      addToast('Document uploaded successfully.', 'success');

      if (fileState.previewUrl) URL.revokeObjectURL(fileState.previewUrl);
      if (onSuccess) onSuccess(documentId);
      if (onClose) onClose();
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'Upload failed. Please try again.';
      setError(message);
      addToast(message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setDocumentType('');
    setIssueDate('');
    setExpiryDate('');
    setFileState(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const resetFile = () => {
    if (fileState?.previewUrl) URL.revokeObjectURL(fileState.previewUrl);
    setFileState(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Card className={cn('w-full max-w-lg', className)}>
      <CardHeader>
        <CardTitle>Upload Document</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Entity badge */}
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground dark:text-zinc-400">
            <span>Linked to:</span>
            <span className="font-medium capitalize">{ENTITY_LABELS[linkedEntityType]} #{linkedEntityId.slice(0, 8)}</span>
          </div>

          {/* Document Type Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Document Type</label>
            <select
              value={documentType}
              onChange={(e) => {
                setDocumentType(e.target.value);
                setError(null);
              }}
              className="flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            >
              <option value="">Select document type...</option>
              {DOCUMENT_TYPES.map((dt) => (
                <option key={dt.value} value={dt.value}>{dt.label}</option>
              ))}
            </select>
          </div>

          {/* Date fields (conditional) */}
          {needsExpiryFields && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Issue Date</label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Expiry Date</label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* File Drop Zone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">File</label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !fileState && inputRef.current?.click()}
              className={cn(
                'relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors',
                isDragOver
                  ? 'border-foreground bg-zinc-50 dark:bg-zinc-900'
                  : 'border-zinc-300 hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-900',
                fileState && 'border-green-500 bg-green-50/50 dark:border-green-600 dark:bg-green-950/20'
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.tiff,.tif"
                onChange={handleFileInput}
                className="hidden"
              />

              {fileState ? (
                <div className="flex flex-col items-center gap-2">
                  {fileState.previewUrl ? (
                    <img
                      src={fileState.previewUrl}
                      alt={fileState.file.name}
                      className="max-h-24 rounded-md object-contain"
                    />
                  ) : (
                    <svg className="h-10 w-10 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 12.473l-1.5 1.875a3.373 3.373 0 01-4.25 0l-4.5-5.625a3.373 3.373 0 010-4.25L8.769 3.375A3.373 3.373 0 0113.019 3.375h1.231m0 12.473V7.125" />
                    </svg>
                  )}
                  <p className="text-sm font-medium truncate max-w-[200px]">{fileState.file.name}</p>
                  <p className="text-xs text-muted-foreground">{(fileState.file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); resetFile(); }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <>
                  <svg className="h-10 w-10 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l5.25 5.25M12 3v13.5" />
                  </svg>
                  <p className="text-sm font-medium">Drop files or click to browse</p>
                  <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX, JPG, PNG, TIFF — max 25 MB</p>
                </>
              )}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={handleReset}
              disabled={isUploading}
            >
              Reset
            </Button>
            <Button
              type="submit"
              isLoading={isUploading}
              disabled={isUploading || !fileState || !documentType}
            >
              {isUploading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Uploading...
                </>
              ) : (
                'Upload'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
