// src/features/social/validation/social.ts
// What may be written into the publishing screens.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';

export const SOCIAL_PLATFORMS = [
  'facebook',
  'instagram',
  'linkedin',
  'x',
  'threads',
  'telegram',
  'pinterest',
  'youtube',
  'tiktok',
] as const;

export const saveChannelSchema = z.object({
  channelId: uuidSchema.optional(),
  platform: z.enum(SOCIAL_PLATFORMS),
  accountName: z
    .string()
    .trim()
    .min(2, 'Name the account as you would recognise it.')
    .max(80, 'Keep the name under eighty characters.'),
  accountHandle: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]{1,50}$/, 'A handle has no spaces or symbols beyond a dot or dash.')
    .optional(),
  externalAccountId: z.string().trim().max(120).optional(),
  accessToken: z.string().trim().max(2000).optional(),
});

export const channelIdSchema = z.object({
  channelId: uuidSchema,
});

export const savePostSchema = z.object({
  postId: uuidSchema.optional(),
  title: z
    .string()
    .trim()
    .min(2, 'Give the post a title so you can find it again.')
    .max(120, 'Keep the title under one hundred and twenty characters.'),
  body: z
    .string()
    .trim()
    .min(1, 'Write something to post.')
    .max(5000, 'That is longer than any network will accept.'),
  linkUrl: z
    .string()
    .trim()
    .url('Enter a full web address.')
    .startsWith('https://', 'The address has to be secure.')
    .optional(),
  hashtags: z.array(z.string().trim().max(40)).max(20).default([]),
});

export const postIdSchema = z.object({
  postId: uuidSchema,
});

export const schedulePostSchema = z.object({
  postId: uuidSchema,
  channelIds: z.array(uuidSchema).min(1, 'Choose at least one account to post to.'),
  scheduledFor: z
    .string()
    .trim()
    .min(10, 'Choose when this should go out.')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Choose a real date and time.')
    .refine(
      (value) => Date.parse(value) > Date.now() - 60000,
      'A post cannot be scheduled for a time that has already passed.'
    ),
});

export const saveRuleSchema = z.object({
  ruleId: uuidSchema.optional(),
  name: z.string().trim().min(2, 'Name the rule.').max(80),
  triggerEvent: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_.]{2,60}$/, 'Choose one of the events the product raises.'),
  bodyTemplate: z
    .string()
    .trim()
    .min(5, 'Write what the post should say.')
    .max(2000, 'Keep the template under two thousand characters.'),
  channelIds: z.array(uuidSchema).default([]),
  requiresApproval: z.boolean().default(true),
  minimumHoursBetweenPosts: z.coerce.number().int().min(1).max(720).default(24),
  isActive: z.boolean().default(false),
});
