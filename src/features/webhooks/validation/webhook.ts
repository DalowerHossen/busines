// src/features/webhooks/validation/webhook.ts
// What may be said about where a business sends its events.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';

/** The events a business may ask to be told about. */
export const WEBHOOK_EVENTS = [
  'invoice.created',
  'invoice.sent',
  'invoice.paid',
  'invoice.overdue',
  'payment.succeeded',
  'payment.failed',
  'payment.refunded',
  'client.created',
  'estimate.accepted',
  'payout.sent',
] as const;

export const saveEndpointSchema = z.object({
  endpointId: uuidSchema.optional(),
  name: z.string().trim().min(2, 'Name it so you recognise it later.').max(80),
  targetUrl: z
    .string()
    .trim()
    .url('Enter a full web address.')
    .startsWith('https://', 'The address has to be secure, starting with https.')
    .max(500),
  subscribedEvents: z
    .array(z.enum(WEBHOOK_EVENTS))
    .min(1, 'Choose at least one event to be told about.'),
  description: z.string().trim().max(300).optional(),
});

export const endpointIdSchema = z.object({
  endpointId: uuidSchema,
});

export const deliveryIdSchema = z.object({
  deliveryId: uuidSchema,
});

export const endpointStateSchema = z.object({
  endpointId: uuidSchema,
  isActive: z.boolean(),
});
