// src/features/files/types.ts
// The shapes the file screens work with: what is stored, how much room is
// left and who has opened what.

export interface StoredFile {
  fileId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  filePurpose: string;
  visibility: string;
  ownerType: string | null;
  ownerId: string | null;
  version: number;
  isCurrent: boolean;
  storageTier: string;
  scanStatus: string;
  altText: string | null;
  accessCount: number;
  uploadedAt: string | null;
  createdAt: string;
}

export interface StorageSummary {
  quotaBytes: number;
  usedBytes: number;
  fileCount: number;
  archivedCount: number;
  orphanCount: number;
  openUploadCount: number;
  usedPercentage: number;
}

export interface UploadPolicy {
  provider: string;
  maxUploadBytes: number;
  allowedMimeTypes: readonly string[];
  isConfigured: boolean;
}

export interface FileAccessEntry {
  entryId: string;
  action: string;
  actorUserId: string | null;
  wasAllowed: boolean;
  denialReason: string | null;
  createdAt: string;
}

export interface UploadTicket {
  sessionId: string;
  uploadUrl: string;
  method: 'PUT' | 'POST';
  headers: Readonly<Record<string, string>>;
  expiresAt: string;
}
