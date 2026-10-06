// src/features/storefronts/validation/storefronts.ts
// What the interface will accept when a shop is connected, keyed, taken live
// or asked to stop.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Give the domain of the shop, such as shop.example.com.')
  .max(120);

export const saveConnectionSchema = z.object({
  connectionId: uuidSchema.optional(),
  platform: z.enum(['woocommerce', 'shopify', 'custom']),
  storeName: z.string().trim().min(2, 'Give the shop a name you will recognise.').max(80),
  storeDomain: domainSchema,
  notifyUrl: z
    .string()
    .trim()
    .url('Give the full web address we should call.')
    .startsWith('https://', 'The address we call has to be secure.')
    .optional(),
  defaultCurrency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, 'Use the three letter currency code.'),
  autoIssueInvoice: z.boolean().default(true),
});

export const issueKeySchema = z.object({
  connectionId: uuidSchema,
});

export const setStatusSchema = z.object({
  connectionId: uuidSchema,
  status: z.enum(['pending_verification', 'active', 'suspended', 'disconnected']),
  reason: z.string().trim().max(200).optional(),
});

export const cancelOrderSchema = z.object({
  orderId: uuidSchema,
  reason: z.string().trim().min(3, 'Say why the order is being cancelled.').max(200),
});

/** What a shop sends when it asks for a payment address. */
export const checkoutSessionSchema = z.object({
  orderId: z.string().trim().min(1, 'Send the reference your shop uses for this order.').max(80),
  orderNumber: z.string().trim().max(40).optional(),
  amount: z.coerce.number().positive('An order has to be worth something.').max(100000000),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, 'Use the three letter currency code.')
    .optional(),
  customerEmail: z.string().trim().email('Send a valid shopper address.').optional(),
  customerName: z.string().trim().max(80).optional(),
  description: z.string().trim().max(200).optional(),
});
