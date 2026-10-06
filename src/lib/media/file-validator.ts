// src/lib/media/file-validator.ts
// Server-side upload validation. File extensions and browser MIME labels are
// hints only; the binary signature and, for XLSX, the ZIP package manifest
// decide the accepted type.
import 'server-only';

import JSZip from 'jszip';

import type { StorageFileCategory } from '@/types/storage';

import { MediaProcessingError } from './errors';

export type ValidatedFileKind =
  | 'png'
  | 'jpeg'
  | 'webp'
  | 'gif'
  | 'svg'
  | 'pdf'
  | 'xlsx'
  | 'csv'
  | 'text'
  | 'json'
  | 'zip';

export interface FileValidationInput {
  readonly fileName: string;
  readonly mimeType: string;
  readonly content: Buffer | Uint8Array;
  readonly category?: StorageFileCategory;
  readonly maxBytes?: number;
}

export interface ValidatedFile {
  readonly fileName: string;
  readonly mimeType: string;
  readonly content: Buffer;
  readonly kind: ValidatedFileKind;
  readonly sizeInBytes: number;
}

export const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const FILE_SIZE_LIMITS: Readonly<Record<StorageFileCategory, number>> = {
  company_logo: 5 * 1024 * 1024,
  company_branding_asset: 10 * 1024 * 1024,
  invoice_pdf: 25 * 1024 * 1024,
  estimate_pdf: 25 * 1024 * 1024,
  receipt_pdf: 25 * 1024 * 1024,
  kyc_document_front: 10 * 1024 * 1024,
  kyc_document_back: 10 * 1024 * 1024,
  expense_receipt: 25 * 1024 * 1024,
  client_attachment: DEFAULT_MAX_UPLOAD_BYTES,
  contract_document: 25 * 1024 * 1024,
  product_image: 10 * 1024 * 1024,
  qr_card_asset: 5 * 1024 * 1024,
  import_export_file: DEFAULT_MAX_UPLOAD_BYTES,
  support_ticket_attachment: DEFAULT_MAX_UPLOAD_BYTES,
  other: DEFAULT_MAX_UPLOAD_BYTES,
};

const MIME_KINDS: Readonly<Record<string, ValidatedFileKind>> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'text/tab-separated-values': 'csv',
  'text/plain': 'text',
  'application/json': 'json',
  'application/zip': 'zip',
};

const EXTENSIONS: Readonly<Record<ValidatedFileKind, readonly string[]>> = {
  png: ['png'],
  jpeg: ['jpg', 'jpeg'],
  webp: ['webp'],
  gif: ['gif'],
  svg: ['svg'],
  pdf: ['pdf'],
  xlsx: ['xlsx'],
  csv: ['csv', 'tsv'],
  text: ['txt', 'text', 'log'],
  json: ['json'],
  zip: ['zip'],
};

const CATEGORY_KINDS: Readonly<Record<StorageFileCategory, readonly ValidatedFileKind[]>> = {
  company_logo: ['png', 'jpeg', 'webp'],
  company_branding_asset: ['png', 'jpeg', 'webp', 'svg'],
  invoice_pdf: ['pdf'],
  estimate_pdf: ['pdf'],
  receipt_pdf: ['pdf'],
  kyc_document_front: ['png', 'jpeg', 'webp', 'pdf'],
  kyc_document_back: ['png', 'jpeg', 'webp', 'pdf'],
  expense_receipt: ['png', 'jpeg', 'webp', 'pdf'],
  client_attachment: ['png', 'jpeg', 'webp', 'gif', 'svg', 'pdf', 'text', 'json', 'zip'],
  contract_document: ['pdf'],
  product_image: ['png', 'jpeg', 'webp'],
  qr_card_asset: ['png', 'jpeg', 'webp'],
  import_export_file: ['csv', 'xlsx', 'zip', 'json'],
  support_ticket_attachment: ['png', 'jpeg', 'webp', 'gif', 'pdf', 'text', 'zip'],
  other: ['png', 'jpeg', 'webp', 'gif', 'svg', 'pdf', 'xlsx', 'csv', 'text', 'json', 'zip'],
};

function normalizedMimeType(value: string): string {
  return value.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

function extensionOf(fileName: string): string {
  const baseName = fileName.trim().split(/[\\/]/u).pop() ?? '';
  const dotIndex = baseName.lastIndexOf('.');
  return dotIndex > -1 ? baseName.slice(dotIndex + 1).toLowerCase() : '';
}

function hasPrefix(content: Buffer, prefix: readonly number[]): boolean {
  return prefix.every((byte, index) => content[index] === byte);
}

function decodeUtf8(content: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(content);
  } catch {
    throw new MediaProcessingError('unsafe_file_content');
  }
}

function detectSimpleKind(content: Buffer, mimeType: string): ValidatedFileKind | null {
  if (hasPrefix(content, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (hasPrefix(content, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (
    hasPrefix(content, [0x52, 0x49, 0x46, 0x46]) &&
    content.subarray(8, 12).toString() === 'WEBP'
  ) {
    return 'webp';
  }
  if (hasPrefix(content, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  if (content.subarray(0, 5).toString('ascii') === '%PDF-') return 'pdf';
  if (
    hasPrefix(content, [0x50, 0x4b, 0x03, 0x04]) ||
    hasPrefix(content, [0x50, 0x4b, 0x05, 0x06])
  ) {
    return mimeType === 'application/zip' ? 'zip' : null;
  }

  const text = decodeUtf8(content.subarray(0, Math.min(content.length, 4096))).replace(
    /^\ufeff/u,
    ''
  );
  if (/^\s*<svg(?:\s|>)/iu.test(text)) return 'svg';
  if (mimeType === 'text/csv' || mimeType === 'text/tab-separated-values') return 'csv';
  if (mimeType === 'text/plain') return 'text';
  if (mimeType === 'application/json') return 'json';
  return null;
}

async function inspectZip(
  content: Buffer
): Promise<{ readonly isXlsx: boolean; readonly hasMacro: boolean }> {
  try {
    const zip = await JSZip.loadAsync(content, { checkCRC32: false, createFolders: false });
    const names = Object.keys(zip.files).map((name) => name.replace(/\\/g, '/'));
    const isXlsx = names.includes('[Content_Types].xml') && names.includes('xl/workbook.xml');
    const hasMacro = names.some((name) => name.toLowerCase().endsWith('vbaproject.bin'));
    return { isXlsx, hasMacro };
  } catch {
    throw new MediaProcessingError('invalid_file');
  }
}

function assertExtensionMatches(kind: ValidatedFileKind, extension: string): void {
  if (!extension || !EXTENSIONS[kind].includes(extension)) {
    throw new MediaProcessingError('invalid_file');
  }
}

function assertAllowedKind(kind: ValidatedFileKind, category?: StorageFileCategory): void {
  if (category && !CATEGORY_KINDS[category].includes(kind)) {
    throw new MediaProcessingError('unsupported_file_type');
  }
}

export async function validateUploadedFile(input: FileValidationInput): Promise<ValidatedFile> {
  const fileName = input.fileName.trim();
  const mimeType = normalizedMimeType(input.mimeType);
  const content = Buffer.from(input.content);
  const maxBytes =
    input.maxBytes ??
    (input.category ? FILE_SIZE_LIMITS[input.category] : DEFAULT_MAX_UPLOAD_BYTES);

  if (
    !fileName ||
    fileName.length > 255 ||
    fileName.includes('..') ||
    !mimeType ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes <= 0
  ) {
    throw new MediaProcessingError('invalid_file');
  }
  if (content.byteLength === 0 || content.byteLength > maxBytes) {
    throw new MediaProcessingError('file_too_large');
  }

  const declaredKind = MIME_KINDS[mimeType];
  if (!declaredKind) throw new MediaProcessingError('unsupported_file_type');

  const simpleKind = detectSimpleKind(content, mimeType);
  let detectedKind = simpleKind;
  if (simpleKind === 'zip' || (content[0] === 0x50 && content[1] === 0x4b)) {
    const zipInfo = await inspectZip(content);
    if (zipInfo.hasMacro) throw new MediaProcessingError('unsafe_file_content');
    detectedKind = zipInfo.isXlsx ? 'xlsx' : 'zip';
  }
  if (!detectedKind || detectedKind !== declaredKind) {
    throw new MediaProcessingError('invalid_file');
  }
  if (detectedKind === 'csv' || detectedKind === 'text' || detectedKind === 'json') {
    const text = decodeUtf8(content).replace(/^\ufeff/u, '');
    if (detectedKind === 'json') {
      try {
        JSON.parse(text);
      } catch {
        throw new MediaProcessingError('invalid_file');
      }
    }
  }

  assertExtensionMatches(detectedKind, extensionOf(fileName));
  assertAllowedKind(detectedKind, input.category);

  return {
    fileName,
    mimeType,
    content,
    kind: detectedKind,
    sizeInBytes: content.byteLength,
  };
}

export async function detectFileKind(
  content: Buffer | Uint8Array,
  mimeType: string
): Promise<ValidatedFileKind> {
  const declaredKind = MIME_KINDS[normalizedMimeType(mimeType)];
  if (!declaredKind) throw new MediaProcessingError('unsupported_file_type');
  const extension = EXTENSIONS[declaredKind][0];
  if (!extension) throw new MediaProcessingError('unsupported_file_type');
  const file = await validateUploadedFile({
    fileName: `validated.${extension}`,
    mimeType,
    content,
  });
  return file.kind;
}
