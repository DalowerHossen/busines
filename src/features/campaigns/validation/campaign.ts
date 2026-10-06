// src/features/campaigns/validation/campaign.ts
// What may be written into a campaign.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';

export const saveSegmentSchema = z.object({
  segmentId: uuidSchema.optional(),
  name: z
    .string()
    .trim()
    .min(2, 'Name the audience.')
    .max(80, 'Keep the name under eighty characters.'),
  description: z.string().trim().max(300).optional(),
});

export const saveCampaignSchema = z.object({
  campaignId: uuidSchema.optional(),
  name: z.string().trim().min(2, 'Name the campaign.').max(120),
  subject: z
    .string()
    .trim()
    .min(3, 'Write the subject line your reader will see first.')
    .max(150, 'A subject over one hundred and fifty characters is cut off.'),
  bodyMarkdown: z
    .string()
    .trim()
    .min(20, 'Write something worth reading.')
    .max(20000, 'That is longer than anybody will read in an email.'),
  campaignType: z.enum(['broadcast', 'sequence']).default('broadcast'),
  segmentId: uuidSchema.optional(),
  preheader: z.string().trim().max(150).optional(),
});

export const campaignIdSchema = z.object({
  campaignId: uuidSchema,
});

export const scheduleCampaignSchema = z.object({
  campaignId: uuidSchema,
  scheduledFor: z
    .string()
    .trim()
    .min(10, 'Choose when this should go out.')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Choose a real date and time.')
    .refine(
      (value) => Date.parse(value) > Date.now() - 300000,
      'A campaign cannot be scheduled for a time that has already passed.'
    ),
});

export const saveStepSchema = z.object({
  campaignId: uuidSchema,
  stepId: uuidSchema.optional(),
  stepNumber: z.coerce.number().int().min(1).max(50),
  name: z.string().trim().min(2, 'Name this message.').max(80),
  subject: z.string().trim().min(3, 'Write a subject line.').max(150),
  bodyMarkdown: z.string().trim().min(20, 'Write something worth reading.').max(20000),
  delayHours: z.coerce
    .number()
    .int()
    .min(0, 'A delay cannot be negative.')
    .max(8760, 'A delay over a year is not a sequence.'),
});
