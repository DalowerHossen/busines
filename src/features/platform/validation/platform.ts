// src/features/platform/validation/platform.ts
// What the platform team may type into the operations console.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';

const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(4, 'Enter a hostname.')
  .max(253, 'That hostname is too long.')
  .regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/,
    'Enter a hostname such as app.example.com.'
  );

export const DOMAIN_PURPOSES = ['app', 'marketing', 'short_link', 'mail', 'assets'] as const;

export const planDomainsSchema = z.object({
  rootDomain: hostnameSchema,
  hostTarget: hostnameSchema,
});

export const saveDomainSchema = z.object({
  purpose: z.enum(DOMAIN_PURPOSES),
  hostname: hostnameSchema,
  isPrimary: z.boolean().default(false),
  notes: z.string().trim().max(300).optional(),
});

export const domainIdSchema = z.object({
  domainId: uuidSchema,
});

export const platformSettingSchema = z.object({
  settingKey: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/, 'That is not a setting we know about.'),
  value: z.string().trim().max(2000),
});
