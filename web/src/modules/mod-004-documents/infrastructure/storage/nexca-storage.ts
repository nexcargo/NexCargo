import { createClient } from '@supabase/supabase-js';
import { DATABASE_URL } from '@/lib/env';

const BUCKET_NAME = 'nexcargow-documents';
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB per MOD-004 §7.3
const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/vnd.ms-photo',
];

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png', '.tiff', '.tif']);

// Admin client (service-role) for server-side storage operations
let adminClientInstance: ReturnType<typeof createClient> | null = null;

function getAdminClient() {
  if (!adminClientInstance) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY environment variable is not set. Storage admin operations require the service-role key.',
      );
    }
    adminClientInstance = createClient(DATABASE_URL, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClientInstance;
}

// Client-facing instance for read/download operations (respects RLS)
let clientInstance: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!clientInstance) {
    clientInstance = createClient(DATABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return clientInstance;
}

export interface FileUploadResult {
  path: string;
  hash: string;
}

/**
 * Compute SHA-256 hash of file content using Web Crypto API.
 */
export async function computeHash(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Construct a deterministic storage path.
 * Format: {linkedEntityType}/{linkedEntityId}/{documentId}/{version}/{filename}
 * If version or filename are omitted, trailing segments are omitted.
 */
export function constructPath(
  linkedEntityType: string,
  linkedEntityId: string,
  documentId: string,
  version?: number,
  filename?: string,
): string {
  let parts = [linkedEntityType, linkedEntityId, documentId];
  if (version !== undefined) {
    parts.push(String(version));
  }
  if (filename !== undefined) {
    parts.push(filename);
  }
  return parts.join('/');
}

/**
 * Validate file extension against allowed types.
 */
function validateFileExtension(filename: string): void {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported file type: ${ext}. Allowed types: PDF, DOCX, XLSX, JPG, JPEG, PNG, TIFF`,
    );
  }
}

/**
 * Ensure the storage bucket exists, creating it if necessary.
 */
export async function ensureBucketExists(): Promise<void> {
  const admin = getAdminClient();

  try {
    const { data: buckets } = await admin.storage.listBuckets();
    const existing = buckets?.find((b) => b.name === BUCKET_NAME);

    if (existing) {
      return;
    }

    const { error } = await admin.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE_BYTES,
    });

    if (error) {
      throw new Error(`Failed to create storage bucket '${BUCKET_NAME}': ${error.message}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      return;
    }
    throw new Error(
      `Bucket '${BUCKET_NAME}' does not exist and could not be created. Please run:\n` +
        `  supabase storage bucket create nexcargow-documents --project-ref <your-project-ref>\n` +
        `Then ensure the SUPABASE_SERVICE_ROLE_KEY environment variable is configured.`,
    );
  }
}

/**
 * Upload a file to the storage bucket.
 * Path format: {linkedEntityType}/{linkedEntityId}/{documentId}/{filename}
 */
export async function uploadFile(
  file: File | Blob,
  category: string,
  documentId: string,
): Promise<FileUploadResult> {
  const admin = getAdminClient();
  const fileName = file instanceof File ? file.name : 'file';

  validateFileExtension(fileName);

  if (typeof file.size === 'number' && file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the 25 MB limit per MOD-004 §7.3.`,
    );
  }

  const fullPath = constructPath(category, '', documentId, undefined, fileName);

  const { error: uploadError } = await admin.storage
    .from(BUCKET_NAME)
    .upload(fullPath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: typeof file === 'object' && 'type' in file ? (file as File).type : undefined,
    });

  if (uploadError) {
    if (uploadError.message.includes('does not exist')) {
      throw new Error(
        `Storage bucket '${BUCKET_NAME}' does not exist. Run ensureBucketExists() first. Setup:\n` +
          `  supabase storage bucket create nexcargow-documents --project-ref <your-project-ref>`,
      );
    }
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const hash = await computeHash(file);

  return {
    path: fullPath,
    hash,
  };
}

/**
 * Download a file by its full storage path.
 */
export async function downloadFile(path: string): Promise<Blob> {
  const admin = getAdminClient();

  const { data, error } = await admin.storage.from(BUCKET_NAME).download(path);

  if (error) {
    if (error.message.includes('not found')) {
      throw new Error(`File not found: ${path}`);
    }
    if (error.message.includes('does not exist')) {
      throw new Error(
        `Storage bucket '${BUCKET_NAME}' does not exist. Create it via:\n` +
          `  supabase storage bucket create nexcargow-documents --project-ref <your-project-ref>`,
      );
    }
    throw new Error(`Storage download failed: ${error.message}`);
  }

  if (!data) {
    throw new Error(`No data returned for path: ${path}`);
  }

  return data;
}

/**
 * Delete a file by its full storage path.
 */
export async function deleteFile(path: string): Promise<void> {
  const admin = getAdminClient();

  const { error } = await admin.storage.from(BUCKET_NAME).remove([path]);

  if (error) {
    if (error.message.includes('not found')) {
      throw new Error(`File not found: ${path}`);
    }
    if (error.message.includes('does not exist')) {
      throw new Error(
        `Storage bucket '${BUCKET_NAME}' does not exist. Create it via:\n` +
          `  supabase storage bucket create nexcargow-documents --project-ref <your-project-ref>`,
      );
    }
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}

/**
 * Get a signed URL for temporary access to a file.
 */
export async function getFileUrl(path: string, expiresInSeconds: number = 3600): Promise<string> {
  const admin = getAdminClient();

  const { data, error } = await admin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    if (error.message.includes('not found')) {
      throw new Error(`File not found: ${path}`);
    }
    if (error.message.includes('does not exist')) {
      throw new Error(
        `Storage bucket '${BUCKET_NAME}' does not exist. Create it via:\n` +
          `  supabase storage bucket create nexcargow-documents --project-ref <your-project-ref>`,
      );
    }
    throw new Error(`Storage URL generation failed: ${error.message}`);
  }

  if (!data?.signedUrl) {
    throw new Error(`Failed to generate signed URL for: ${path}`);
  }

  return data.signedUrl;
}
