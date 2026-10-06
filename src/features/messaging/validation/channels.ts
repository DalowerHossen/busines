// src/features/messaging/validation/channels.ts
// What the interface will accept when a business configures how it reaches
// people. A number has to look like a number, a chain has to have something
// in it, and money cannot be negative.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';

/** The channels a business can configure besides email. */
export const OUTBOUND_CHANNEL_VALUES = ['sms', 'whatsapp', 'telegram', 'viber'] as const;

export const outboundChannelSchema = z.enum(OUTBOUND_CHANNEL_VALUES);

const timeSchema = z
  .string()
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Give the time as hours and minutes, such as 21:00.');

export const saveChannelSchema = z
  .object({
    channel: outboundChannelSchema,
    provider: z
      .string()
      .trim()
      .regex(
        /^[a-z][a-z0-9_]{2,40}$/,
        'Use lower case letters, numbers and underscores for the provider key.'
      ),
    displayName: z.string().trim().min(2, 'Give this channel a name.').max(60),
    senderNumber: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{6,20}$/, 'Give the sending number in full, with its country code.')
      .optional(),
    senderHandle: z.string().trim().min(2).max(60).optional(),
    costPerMessage: z.coerce
      .number()
      .min(0, 'A message cannot cost less than nothing.')
      .max(100, 'That is higher than any message costs. Check the figure.')
      .default(0),
    costCurrency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'Use the three letter currency code.')
      .default('USD'),
    dailySendLimit: z.coerce
      .number()
      .int()
      .positive('A daily limit has to be at least one message.')
      .max(100000)
      .optional(),
    routingPriority: z.coerce.number().int().min(1).max(1000).default(100),
    quietHoursStart: timeSchema.optional(),
    quietHoursEnd: timeSchema.optional(),
    adapterSettings: z.record(z.string().trim().max(400)).default({}),
  })
  .superRefine((value, context) => {
    if ((value.quietHoursStart === undefined) !== (value.quietHoursEnd === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quietHoursEnd'],
        message: 'Give both ends of the quiet period, or neither.',
      });
    }

    const needsNumber =
      value.channel === 'sms' || value.channel === 'whatsapp' || value.channel === 'viber';

    if (needsNumber && !value.senderNumber) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['senderNumber'],
        message: 'This channel sends from a number, so one is needed.',
      });
    }
  });

export type SaveChannelInput = z.infer<typeof saveChannelSchema>;

export const channelStateSchema = z.object({
  channelId: uuidSchema,
  isActive: z.boolean(),
});

export const channelIdSchema = z.object({
  channelId: uuidSchema,
});

export const saveRouteSchema = z.object({
  routeKey: z
    .string()
    .trim()
    .regex(
      /^[a-z][a-z0-9_.]{2,60}$/,
      'Use lower case letters, numbers, dots and underscores for the key.'
    ),
  name: z.string().trim().min(2, 'Give this chain a name.').max(80),
  description: z.string().trim().max(400).optional(),
  isActive: z.boolean().default(true),
  stopOnDelivery: z.boolean().default(true),
  stopOnEngagement: z.boolean().default(true),
  respectQuietHours: z.boolean().default(true),
  requiresConsent: z.boolean().default(true),
});

export const routeStepsSchema = z.object({
  routeId: uuidSchema,
  steps: z
    .array(
      z.object({
        channel: z.enum(['email', 'sms', 'whatsapp', 'telegram', 'viber']),
        templateKey: z.string().trim().max(80).optional(),
        waitMinutes: z.coerce.number().int().min(0).max(20160).default(60),
        isRequired: z.boolean().default(false),
      })
    )
    .min(1, 'A chain needs at least one channel in it.')
    .max(10, 'A chain cannot have more than ten channels in it.')
    .superRefine((steps, context) => {
      const seen = new Set<string>();

      for (const step of steps) {
        if (seen.has(step.channel)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'A chain cannot try the same channel twice.',
          });

          return;
        }

        seen.add(step.channel);
      }
    }),
});

export const stopRunSchema = z.object({
  runId: uuidSchema,
  reason: z.string().trim().min(3, 'Say why the chain is being stopped.').max(200),
});

export const resolveReplySchema = z.object({
  inboundId: uuidSchema,
  note: z.string().trim().max(400).optional(),
});
