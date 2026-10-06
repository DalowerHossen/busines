// src/features/files/validation/files.ts
// What the interface will accept when a file is uploaded, renamed or removed.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';

/** What a stored file may be for. */
export const FILE_PURPOSES = [
  'attachment',
  'receipt',
  'logo',
  'avatar',
  'kyc_document',
  'product_image',
  'marketing_asset',
  'import',
] as const;

export const requestUploadSchema = z.object({
  fileName: z.string().trim().min(1, 'Give the file a name.').max(255),
  mimeType: z
    .string()
    .trim()
    .regex(/^[a-z]+\/[a-z0-9.+-]+$/, 'That file type cannot be read.'),
  byteSize: z.coerce
    .number()
    .int('A file size has to be a whole number of bytes.')
    .positive('An empty file cannot be uploaded.')
    .max(5368709120),
  filePurpose: z.enum(FILE_PURPOSES).default('attachment'),
  ownerType: z.string().trim().max(40).optional(),
  ownerId: uuidSchema.optional(),
});

export const completeUploadSchema = z.object({
  sessionId: uuidSchema,
  byteSize: z.coerce.number().int().positive().max(5368709120),
  contentHash: z
    .string()
    .trim()
    .regex(/^[0-9a-f]{64}$/, 'The checksum of the file could not be read.')
    .optional(),
  /** Identifier the drive gave the file, when the store names its own. */
  externalObjectId: z.string().trim().max(200).optional(),
});

export const renameFileSchema = z.object({
  fileId: uuidSchema,
  fileName: z.string().trim().min(1, 'Give the file a name.').max(255),
  altText: z.string().trim().max(200).optional(),
});

export const deleteFileSchema = z.object({
  fileId: uuidSchema,
  reason: z.string().trim().max(200).optional(),
});
