// src/features/storage/validation/storage.ts
// What the platform console will accept when a file store is configured.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';

/** The kinds of store the platform can write to. */
export const STORAGE_PROVIDERS = [
  'cloudflare_r2',
  'aws_s3',
  'backblaze_b2',
  'wasabi',
  'supabase',
  'local_disk',
  'google_drive',
] as const;

const secureUrlSchema = z
  .string()
  .trim()
  .url('Give the full web address.')
  .startsWith('https://', 'The address has to be secure.');

export const saveTargetSchema = z.object({
  targetId: uuidSchema.optional(),
  name: z.string().trim().min(2, 'Give the store a name you will recognise.').max(60),
  provider: z.enum(STORAGE_PROVIDERS),
  bucketName: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9._-]{1,62}$/, 'That is not a valid bucket name.'),
  region: z.string().trim().max(40).optional(),
  endpointUrl: secureUrlSchema.optional(),
  pathPrefix: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9/_-]{0,80}$/, 'Use letters, numbers, slashes and dashes.')
    .optional(),
  publicBaseUrl: secureUrlSchema.optional(),
  forcePathStyle: z.boolean().default(false),
  signedUrlTtlSeconds: z.coerce
    .number()
    .int()
    .min(60, 'An address has to last at least a minute.')
    .max(604800, 'An address cannot last more than a week.'),
  maxUploadBytes: z.coerce
    .number()
    .int()
    .min(1024, 'The limit has to be at least a kilobyte.')
    .max(5368709120, 'The limit cannot be more than five gigabytes.'),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export const targetIdSchema = z.object({
  targetId: uuidSchema,
});

export const setCredentialsSchema = z.object({
  targetId: uuidSchema,
  accessKeyId: z.string().trim().min(4, 'Paste the key the store gave you.').max(200).optional(),
  secretAccessKey: z
    .string()
    .trim()
    .min(8, 'Paste the secret the store gave you.')
    .max(400)
    .optional(),
  serviceKey: z.string().trim().min(8, 'Paste the service key.').max(2000).optional(),
  projectUrl: secureUrlSchema.optional(),
});
