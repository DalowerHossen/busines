// src/features/loyalty/validation/loyalty.ts
// What the interface will accept when a loyalty scheme is written, a reward
// is offered, a client is asked for a review, or a quote is published.

import { z } from 'zod';

import { isoDateSchema, moneySchema, uuidSchema } from '@/lib/validation/primitives';

export const saveProgramSchema = z.object({
  programId: uuidSchema.optional(),
  name: z.string().trim().min(2, 'Give the scheme a name your clients will recognise.').max(80),
  description: z.string().trim().max(400).optional(),
  isActive: z.boolean().default(true),
  pointsPerCurrencyUnit: z.coerce
    .number()
    .positive('Say how many points a unit of spending earns.')
    .max(1000),
  earnOn: z.enum(['payment', 'invoice_paid', 'subscription_renewal', 'referral', 'manual']),
  minimumSpend: moneySchema,
  pointValue: z.coerce.number().positive('A point has to be worth something.').max(100),
  minimumRedemptionPoints: z.coerce.number().int().min(1).max(1000000),
  redemptionMultiple: z.coerce.number().int().min(1).max(1000000),
  pointsExpireAfterMonths: z.coerce.number().int().min(1).max(120).optional(),
  silverThreshold: z.coerce.number().int().min(1).max(10000000).optional(),
  goldThreshold: z.coerce.number().int().min(1).max(10000000).optional(),
  platinumThreshold: z.coerce.number().int().min(1).max(10000000).optional(),
  termsUrl: z.string().trim().url('Give the full web address of your terms.').optional(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, 'Use the three letter currency code.'),
});

export const saveRewardSchema = z.object({
  programId: uuidSchema,
  rewardId: uuidSchema.optional(),
  name: z.string().trim().min(2, 'Give the reward a name.').max(80),
  description: z.string().trim().max(400).optional(),
  rewardType: z.enum([
    'invoice_credit',
    'percentage_discount',
    'free_product',
    'service_upgrade',
    'donation',
  ]),
  pointsCost: z.coerce.number().int().min(1, 'A reward has to cost some points.').max(10000000),
  creditAmount: moneySchema.optional(),
  discountPercentage: z.coerce.number().min(0.01).max(100).optional(),
  minimumTier: z.enum(['standard', 'silver', 'gold', 'platinum']),
  stockQuantity: z.coerce.number().int().min(0).max(1000000).optional(),
  perMemberLimit: z.coerce.number().int().min(1).max(1000).optional(),
  availableFrom: isoDateSchema.optional(),
  availableUntil: isoDateSchema.optional(),
  displayOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const setRewardActiveSchema = z.object({
  rewardId: uuidSchema,
  isActive: z.boolean(),
});

export const inviteReviewSchema = z.object({
  invoiceId: uuidSchema,
});

export const saveTestimonialSchema = z.object({
  testimonialId: uuidSchema.optional(),
  reviewRequestId: uuidSchema.optional(),
  authorName: z.string().trim().min(2, 'Say who said it.').max(80),
  authorTitle: z.string().trim().max(80).optional(),
  authorCompany: z.string().trim().max(80).optional(),
  quote: z.string().trim().min(20, 'A quote needs to be long enough to mean something.').max(600),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  consentGiven: z.boolean().default(false),
  displaySurface: z.enum(['home', 'pricing', 'features', 'checkout', 'landing']),
  isFeatured: z.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).max(999).default(100),
});

export const approveTestimonialSchema = z.object({
  testimonialId: uuidSchema,
});
