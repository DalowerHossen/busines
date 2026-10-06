// src/lib/storage/google-drive.ts
// Server-only Google Drive v3 adapter. Credentials and the Drive client stay
// in this module; browser code receives only provider metadata or an
// application-gated URL.
import 'server-only';

import { Readable } from 'node:stream';

import { google, type drive_v3 } from 'googleapis';

import type {
  StorageAdapter,
  StorageDeleteInput,
  StorageFileCategory,
  StorageFileMetadata,
  StorageFileVisibility,
  StorageProviderId,
  StorageSignedUrlInput,
  StorageUploadInput,
} from '@/types/storage';

import { StorageProviderError } from './errors';
import { makeApplicationSignedUrl } from './signed-links';
import type { StorageFolderStore } from './folder-store';

export { verifyGoogleDriveApplicationSignature } from './signed-links';

const GOOGLE_DRIVE_PROVIDER: StorageProviderId = 'google_drive';
const GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const DEFAULT_PRIVATE_LINK_TTL_SECONDS = 900;
const MIN_SIGNED_URL_TTL_SECONDS = 60;
const MAX_SIGNED_URL_TTL_SECONDS = 86_400;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const FILE_FIELDS =
  'id,name,mimeType,size,createdTime,webViewLink,webContentLink,resourceKey,parents,appProperties,trashed';
const FOLDER_FIELDS = 'id,name,mimeType,parents,appProperties,trashed';

export interface GoogleDriveStorageConfig {
  readonly clientEmail: string;
  readonly privateKey: string;
  readonly rootFolderId: string;
  readonly applicationUrl: string;
  readonly linkSigningSecret: string;
  readonly maxUploadBytes?: number;
}

export interface GoogleDriveDownload {
  readonly body: NodeJS.ReadableStream;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeInBytes: number;
}

type DriveClient = Pick<drive_v3.Drive, 'files' | 'permissions'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getGoogleStatusCode(error: unknown): number | null {
  if (!isRecord(error)) return null;
  const response = error.response;
  if (isRecord(response) && typeof response.status === 'number') {
    return response.status;
  }
  return typeof error.code === 'number' ? error.code : null;
}

function asGoogleError(
  error: unknown,
  code: 'provider_request_failed' | 'provider_response_invalid'
) {
  const statusCode = getGoogleStatusCode(error);
  return new StorageProviderError(
    GOOGLE_DRIVE_PROVIDER,
    code,
    statusCode,
    statusCode === 429 || statusCode === 408 || (statusCode !== null && statusCode >= 500)
  );
}

function assertUuid(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'invalid_request', 400);
  }
}

function sanitizeFileName(fileName: string): string {
  const sanitized = fileName
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, '-')
    .trim()
    .slice(0, 180);

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'invalid_request', 400);
  }

  return sanitized;
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function safeAppPropertyValue(value: string): string {
  if (!value || value.length > 124) {
    throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'invalid_request', 400);
  }
  return value;
}

function getRequiredString(value: string | null | undefined): string {
  if (!value) throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'provider_response_invalid');
  return value;
}

function getDriveFileId(file: drive_v3.Schema$File): string {
  return getRequiredString(file.id);
}

function getDriveFileSize(file: drive_v3.Schema$File, fallback: number): number {
  if (file.size === null || file.size === undefined) return fallback;
  const size = Number(file.size);
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'provider_response_invalid');
  }
  return size;
}

function getDriveFileUrl(file: drive_v3.Schema$File): string {
  const url = file.webViewLink ?? file.webContentLink;
  if (!url || !/^https:\/\//i.test(url)) {
    throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'provider_response_invalid');
  }
  return url;
}

function getApplicationUrl(applicationUrl: string): string {
  try {
    const url = new URL(applicationUrl);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
      throw new Error('Application URL must use HTTPS.');
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'invalid_configuration');
  }
}

function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, '\n');
}

function createDriveClient(config: GoogleDriveStorageConfig): DriveClient {
  try {
    const auth = new google.auth.JWT({
      email: config.clientEmail,
      key: normalizePrivateKey(config.privateKey),
      scopes: [GOOGLE_DRIVE_SCOPE],
    });
    return google.drive({ version: 'v3', auth });
  } catch {
    throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'invalid_configuration');
  }
}

export class GoogleDriveStorageAdapter implements StorageAdapter {
  readonly providerId = GOOGLE_DRIVE_PROVIDER;
  private readonly drive: DriveClient;
  private readonly applicationUrl: string;
  private readonly maxUploadBytes: number;

  constructor(
    private readonly config: GoogleDriveStorageConfig,
    private readonly folderStore: StorageFolderStore,
    driveClient?: DriveClient
  ) {
    if (!config.clientEmail || !config.privateKey || !config.rootFolderId) {
      throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'invalid_configuration');
    }
    if (!config.linkSigningSecret || config.linkSigningSecret.length < 32) {
      throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'invalid_configuration');
    }
    if (!folderStore) {
      throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'invalid_configuration');
    }

    this.applicationUrl = getApplicationUrl(config.applicationUrl);
    this.maxUploadBytes = config.maxUploadBytes ?? MAX_UPLOAD_BYTES;
    if (!Number.isSafeInteger(this.maxUploadBytes) || this.maxUploadBytes <= 0) {
      throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'invalid_configuration');
    }
    this.drive = driveClient ?? createDriveClient(config);
  }

  async uploadFile(input: StorageUploadInput): Promise<StorageFileMetadata> {
    assertUuid(input.companyId);
    const fileName = sanitizeFileName(input.fileName);
    const mimeType = input.mimeType.trim();
    const content = Buffer.from(input.content);
    const visibility: StorageFileVisibility = input.visibility === 'public' ? 'public' : 'private';

    if (!mimeType || !Number.isSafeInteger(input.sizeInBytes) || input.sizeInBytes < 0) {
      throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'invalid_request', 400);
    }
    if (input.sizeInBytes !== content.byteLength || content.byteLength > this.maxUploadBytes) {
      throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'invalid_request', 413);
    }

    const companyFolderId = await this.ensureCompanyFolder(input.companyId);
    const appProperties = this.fileAppProperties(input.companyId, input.category);
    let uploadedFile: drive_v3.Schema$File | null = null;

    try {
      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          mimeType,
          parents: [companyFolderId],
          appProperties,
        },
        media: {
          mimeType,
          body: Readable.from(content),
        },
        fields: FILE_FIELDS,
        supportsAllDrives: true,
      });
      uploadedFile = response.data;

      const providerFileId = getDriveFileId(uploadedFile);
      if (visibility === 'public') {
        await this.drive.permissions.create({
          fileId: providerFileId,
          requestBody: {
            type: 'anyone',
            role: 'reader',
            allowFileDiscovery: false,
          },
          fields: 'id,type,role',
          supportsAllDrives: true,
        });
      }

      const finalFile = await this.getFile(providerFileId);
      this.assertManagedFile(finalFile, input.companyId, companyFolderId);
      // Private files never receive an `anyone` permission. Their returned
      // URL is an application signature, not a fabricated Drive URL.
      const url =
        visibility === 'public'
          ? getDriveFileUrl(finalFile)
          : this.createSignedUrl(input.companyId, providerFileId, DEFAULT_PRIVATE_LINK_TTL_SECONDS);

      return {
        providerFileId,
        provider: this.providerId,
        url,
        fileName: getRequiredString(finalFile.name),
        mimeType: getRequiredString(finalFile.mimeType),
        sizeInBytes: getDriveFileSize(finalFile, input.sizeInBytes),
        visibility,
        uploadedAt: finalFile.createdTime ?? new Date().toISOString(),
      };
    } catch (error) {
      if (uploadedFile?.id) {
        await this.deleteUploadedFileAfterFailure(uploadedFile.id);
      }
      if (error instanceof StorageProviderError) throw error;
      throw asGoogleError(error, 'provider_request_failed');
    }
  }

  async deleteFile(input: StorageDeleteInput): Promise<void> {
    assertUuid(input.companyId);
    const file = await this.getFile(input.providerFileId);
    const parentFolderId = this.assertManagedFile(file, input.companyId);
    await this.assertCompanyFolder(parentFolderId, input.companyId);

    try {
      await this.drive.files.delete({
        fileId: input.providerFileId,
        supportsAllDrives: true,
      });
    } catch (error) {
      throw asGoogleError(error, 'provider_request_failed');
    }
  }

  async getSignedUrl(input: StorageSignedUrlInput): Promise<string> {
    assertUuid(input.companyId);
    if (
      !Number.isSafeInteger(input.expiresInSeconds) ||
      input.expiresInSeconds < MIN_SIGNED_URL_TTL_SECONDS ||
      input.expiresInSeconds > MAX_SIGNED_URL_TTL_SECONDS
    ) {
      throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'invalid_request', 400);
    }

    const file = await this.getFile(input.providerFileId);
    const parentFolderId = this.assertManagedFile(file, input.companyId);
    await this.assertCompanyFolder(parentFolderId, input.companyId);

    return this.createSignedUrl(input.companyId, input.providerFileId, input.expiresInSeconds);
  }

  /**
   * Streams a previously authorized file through the application route. This
   * is intentionally not part of StorageAdapter: future providers can expose
   * their own server-side download primitive without leaking SDK details into
   * provider-neutral call sites.
   */
  async downloadFile(companyId: string, providerFileId: string): Promise<GoogleDriveDownload> {
    assertUuid(companyId);
    const file = await this.getFile(providerFileId);
    const parentFolderId = this.assertManagedFile(file, companyId);
    await this.assertCompanyFolder(parentFolderId, companyId);

    try {
      const response = await this.drive.files.get(
        {
          fileId: providerFileId,
          alt: 'media',
          supportsAllDrives: true,
        },
        { responseType: 'stream' }
      );
      return {
        body: response.data as NodeJS.ReadableStream,
        fileName: getRequiredString(file.name),
        mimeType: getRequiredString(file.mimeType),
        sizeInBytes: getDriveFileSize(file, 0),
      };
    } catch (error) {
      throw asGoogleError(error, 'provider_request_failed');
    }
  }

  private fileAppProperties(
    companyId: string,
    category: StorageFileCategory
  ): Record<string, string> {
    return {
      kd_company_id: safeAppPropertyValue(companyId),
      kd_provider: GOOGLE_DRIVE_PROVIDER,
      kd_category: safeAppPropertyValue(category),
      kd_managed_by: 'kd_solution_it',
    };
  }

  private createSignedUrl(
    companyId: string,
    providerFileId: string,
    expiresInSeconds: number
  ): string {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    return makeApplicationSignedUrl(
      this.applicationUrl,
      this.config.linkSigningSecret,
      companyId,
      providerFileId,
      expiresAt
    );
  }

  private async ensureCompanyFolder(companyId: string): Promise<string> {
    const mappedFolderId = await this.folderStore.findCompanyFolder(companyId, this.providerId);
    if (mappedFolderId) {
      await this.assertCompanyFolder(mappedFolderId, companyId);
      return mappedFolderId;
    }

    const query = [
      `mimeType = '${GOOGLE_DRIVE_FOLDER_MIME_TYPE}'`,
      'trashed = false',
      `'${escapeDriveQueryValue(this.config.rootFolderId)}' in parents`,
      `appProperties has { key = 'kd_company_id' and value = '${escapeDriveQueryValue(companyId)}' }`,
      `appProperties has { key = 'kd_provider' and value = '${GOOGLE_DRIVE_PROVIDER}' }`,
    ].join(' and ');

    try {
      const existing = await this.drive.files.list({
        q: query,
        pageSize: 2,
        fields: `files(${FOLDER_FIELDS})`,
        corpora: 'allDrives',
        spaces: 'drive',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });
      const existingFolder = existing.data.files?.[0];
      if (existingFolder?.id) {
        const claimedId = await this.folderStore.claimCompanyFolder(
          companyId,
          this.providerId,
          existingFolder.id
        );
        await this.assertCompanyFolder(claimedId, companyId);
        return claimedId;
      }

      const created = await this.drive.files.create({
        requestBody: {
          name: `KD SOLUTION IT - ${companyId}`,
          mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
          parents: [this.config.rootFolderId],
          appProperties: {
            kd_company_id: companyId,
            kd_provider: GOOGLE_DRIVE_PROVIDER,
            kd_managed_by: 'kd_solution_it',
          },
        },
        fields: FOLDER_FIELDS,
        supportsAllDrives: true,
      });
      const createdId = getDriveFileId(created.data);
      const claimedId = await this.folderStore.claimCompanyFolder(
        companyId,
        this.providerId,
        createdId
      );

      if (claimedId !== createdId) {
        await this.deleteUploadedFileAfterFailure(createdId);
      }
      await this.assertCompanyFolder(claimedId, companyId);
      return claimedId;
    } catch (error) {
      if (error instanceof StorageProviderError) throw error;
      throw asGoogleError(error, 'provider_request_failed');
    }
  }

  private async getFile(providerFileId: string): Promise<drive_v3.Schema$File> {
    if (!providerFileId || providerFileId.length > 500) {
      throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'invalid_request', 400);
    }
    try {
      const response = await this.drive.files.get({
        fileId: providerFileId,
        fields: FILE_FIELDS,
        supportsAllDrives: true,
      });
      return response.data;
    } catch (error) {
      throw asGoogleError(error, 'provider_request_failed');
    }
  }

  private async assertCompanyFolder(folderId: string, companyId: string): Promise<void> {
    try {
      const response = await this.drive.files.get({
        fileId: folderId,
        fields: FOLDER_FIELDS,
        supportsAllDrives: true,
      });
      const folder = response.data;
      if (
        folder.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE ||
        folder.trashed ||
        folder.appProperties?.kd_company_id !== companyId ||
        folder.appProperties?.kd_provider !== GOOGLE_DRIVE_PROVIDER ||
        !folder.parents?.includes(this.config.rootFolderId)
      ) {
        throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'tenant_scope_denied', 403);
      }
    } catch (error) {
      if (error instanceof StorageProviderError) throw error;
      throw asGoogleError(error, 'provider_request_failed');
    }
  }

  private assertManagedFile(
    file: drive_v3.Schema$File,
    companyId: string,
    expectedParentId?: string
  ): string {
    const parentFolderId = file.parents?.[0];
    if (
      file.trashed ||
      file.appProperties?.kd_company_id !== companyId ||
      file.appProperties?.kd_provider !== GOOGLE_DRIVE_PROVIDER ||
      file.appProperties?.kd_managed_by !== 'kd_solution_it' ||
      !parentFolderId ||
      (expectedParentId !== undefined && parentFolderId !== expectedParentId)
    ) {
      throw new StorageProviderError(GOOGLE_DRIVE_PROVIDER, 'tenant_scope_denied', 403);
    }
    return parentFolderId;
  }

  private async deleteUploadedFileAfterFailure(providerFileId: string): Promise<void> {
    try {
      await this.drive.files.delete({
        fileId: providerFileId,
        supportsAllDrives: true,
      });
    } catch {
      // The original provider error is more useful to the caller. A cleanup
      // failure is retained in provider logs by the surrounding request.
    }
  }
}

export function createGoogleDriveStorageAdapter(
  config: GoogleDriveStorageConfig,
  folderStore: StorageFolderStore
): GoogleDriveStorageAdapter {
  return new GoogleDriveStorageAdapter(config, folderStore);
}
