// src/types/storage.ts
// Shared contract every file storage provider must implement. Google Drive
// is the default and mandatory-by-default provider (see
// docs/planning/ARCHITECTURE-DECISIONS.md section 7); this interface keeps
// the rest of the application decoupled from any single provider so a
// company or the platform can swap to Cloudflare R2, S3, Backblaze B2, or
// local disk without touching call sites. Concrete providers are
// implemented starting in Phase 21 (Google Drive storage adapter); this
// file only defines the shape they must satisfy.

/**
 * Every storage provider the platform can be configured to use. `local` is
 * for development only and must never be selected in production.
 */
export type StorageProviderId =
  | 'google_drive'
  | 'supabase'
  | 'r2'
  | 's3'
  | 'b2'
  | 'wasabi'
  | 'local';

/**
 * Broad category of a stored file, used to pick a target folder/bucket
 * layout and to apply the correct retention and access rules.
 */
export type StorageFileCategory =
  | 'company_logo'
  | 'company_branding_asset'
  | 'invoice_pdf'
  | 'estimate_pdf'
  | 'receipt_pdf'
  | 'kyc_document_front'
  | 'kyc_document_back'
  | 'expense_receipt'
  | 'client_attachment'
  | 'contract_document'
  | 'product_image'
  | 'qr_card_asset'
  | 'import_export_file'
  | 'support_ticket_attachment'
  | 'other';

/**
 * Visibility level requested for a stored file. `private` files are only
 * reachable through a signed, time-limited, or token-gated URL; `public`
 * files (for example a company logo rendered on a public invoice page) are
 * reachable through a stable public URL.
 */
export type StorageFileVisibility = 'private' | 'public';

/**
 * Input accepted by every provider's `uploadFile` implementation.
 */
export interface StorageUploadInput {
  /** Tenant the file belongs to. Every uploaded file is scoped to one company. */
  readonly companyId: string;
  /** Logical category, used for folder layout and retention rules. */
  readonly category: StorageFileCategory;
  /** Original file name supplied by the uploader, sanitised before storage. */
  readonly fileName: string;
  /** IANA media type, validated against the category's allow-list before upload. */
  readonly mimeType: string;
  /** File size in bytes, validated against the per-category size limit before upload. */
  readonly sizeInBytes: number;
  /** Raw file bytes to upload. */
  readonly content: Buffer | Uint8Array;
  /** Whether the uploaded file should be publicly reachable or token-gated. */
  readonly visibility: StorageFileVisibility;
}

/**
 * Metadata persisted in Supabase Postgres after a successful upload.
 * Supabase never stores the file binary itself, only this record.
 */
export interface StorageFileMetadata {
  /** Provider-specific unique identifier for the stored file (e.g. a Google Drive file id). */
  readonly providerFileId: string;
  /** Which provider currently holds this file's binary content. */
  readonly provider: StorageProviderId;
  /** Durable URL to fetch or view the file, subject to the requested visibility. */
  readonly url: string;
  /** Sanitised file name as stored. */
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeInBytes: number;
  readonly visibility: StorageFileVisibility;
  /** ISO-8601 timestamp of when the upload completed. */
  readonly uploadedAt: string;
}

/**
 * Input accepted by every provider's `deleteFile` implementation.
 */
export interface StorageDeleteInput {
  readonly companyId: string;
  readonly providerFileId: string;
}

/**
 * Input accepted by every provider's `getSignedUrl` implementation, used to
 * grant temporary access to a private file (for example a KYC document
 * opened by a reviewer in the super admin console).
 */
export interface StorageSignedUrlInput {
  readonly companyId: string;
  readonly providerFileId: string;
  /** How long the signed URL stays valid, in seconds. */
  readonly expiresInSeconds: number;
}

/**
 * The contract every storage provider adapter implements. A single factory
 * (added in Phase 21) reads `STORAGE_PROVIDER` and returns the matching
 * implementation of this interface; every other module depends only on
 * this interface, never on a specific provider's SDK.
 */
export interface StorageAdapter {
  readonly providerId: StorageProviderId;
  uploadFile(input: StorageUploadInput): Promise<StorageFileMetadata>;
  deleteFile(input: StorageDeleteInput): Promise<void>;
  getSignedUrl(input: StorageSignedUrlInput): Promise<string>;
}
