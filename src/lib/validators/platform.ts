import { z } from 'zod';
import {
  countryCodeSchema,
  currencyCodeSchema,
  isoDateTimeSchema,
  longTextSchema,
  moneySchema,
  percentageSchema,
  positiveAmountSchema,
  shortTextSchema,
  slugSchema,
  urlSchema,
  uuidSchema,
} from './common';

export const supportTicketCreateSchema = z
  .object({
    subject: shortTextSchema.max(255, 'Subject must be 255 characters or fewer.'),
    category: z.enum(['billing', 'technical', 'account', 'payment', 'other']),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    message: longTextSchema.max(20_000, 'Message must be 20,000 characters or fewer.'),
    attachmentProviderFileIds: z
      .array(shortTextSchema.max(255, 'Attachment reference is invalid.'))
      .max(10),
  })
  .strict();

export const supportTicketReplySchema = z
  .object({
    ticketId: uuidSchema,
    message: longTextSchema.max(20_000, 'Message must be 20,000 characters or fewer.'),
    attachmentProviderFileIds: z
      .array(shortTextSchema.max(255, 'Attachment reference is invalid.'))
      .max(10),
  })
  .strict();

export const supportTicketStatusSchema = z
  .object({ ticketId: uuidSchema, status: z.enum(['open', 'pending', 'resolved', 'closed']) })
  .strict();

export const couponCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{2,63}$/u, 'Coupon code is invalid.'),
    discountType: z.enum(['percentage', 'fixed_amount']),
    discountValue: positiveAmountSchema,
    currency: currencyCodeSchema.nullable().optional(),
    maxRedemptions: z.number().int().positive().max(10_000_000).nullable().optional(),
    validFrom: isoDateTimeSchema,
    validUntil: isoDateTimeSchema.nullable().optional(),
    appliesTo: z.enum(['all_plans', 'specific_plans']),
    planIds: z.array(uuidSchema).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.validUntil && Date.parse(value.validUntil) < Date.parse(value.validFrom)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['validUntil'],
        message: 'Coupon end date cannot be earlier than the start date.',
      });
    }
    if (
      value.discountType === 'percentage' &&
      !percentageSchema.safeParse(value.discountValue).success
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Percentage discount cannot exceed 100.',
      });
    }
    if (value.discountType === 'fixed_amount' && !value.currency) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currency'],
        message: 'Currency is required for a fixed discount.',
      });
    }
    if (value.appliesTo === 'specific_plans' && value.planIds.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['planIds'],
        message: 'Select at least one plan.',
      });
    }
  });

export const couponRedemptionSchema = z
  .object({ couponCode: z.string().trim().toUpperCase().min(3).max(64), planId: uuidSchema })
  .strict();

export const kycDocumentSchema = z
  .object({
    documentType: z.enum(['id_front', 'id_back', 'business_registration']),
    providerFileId: shortTextSchema.max(255, 'File reference must be 255 characters or fewer.'),
    originalFileName: shortTextSchema.max(255, 'File name must be 255 characters or fewer.'),
    mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
    sizeBytes: z.number().int().positive().max(25_000_000, 'KYC document cannot exceed 25 MB.'),
    contentSha256: z
      .string()
      .trim()
      .regex(/^[0-9a-f]{64}$/iu, 'Content hash is invalid.')
      .optional(),
  })
  .strict();

export const kycSubmissionSchema = z
  .object({
    companyId: uuidSchema,
    documents: z.array(kycDocumentSchema).min(1, 'Upload at least one KYC document.').max(10),
  })
  .strict()
  .superRefine((value, context) => {
    const documentTypes = new Set(value.documents.map((document) => document.documentType));
    if (documentTypes.has('id_back') && !documentTypes.has('id_front')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documents'],
        message: 'An ID back document requires an ID front document.',
      });
    }
  });

const optionalReviewNotesSchema = z
  .string()
  .trim()
  .max(10_000, 'Reviewer notes must be 10,000 characters or fewer.')
  .optional();

export const kycReviewSchema = z
  .object({
    submissionId: uuidSchema,
    decision: z.enum(['approve', 'reject']),
    rejectionReason: shortTextSchema
      .max(2_000, 'Rejection reason must be 2,000 characters or fewer.')
      .optional(),
    reviewerNotes: optionalReviewNotesSchema,
    reviewedAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.decision === 'reject' && !value.rejectionReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rejectionReason'],
        message: 'A rejection reason is required.',
      });
    }
  });

export const payoutDestinationCreateSchema = z
  .object({
    displayName: shortTextSchema.max(160, 'Destination name must be 160 characters or fewer.'),
    destinationType: z.enum(['bank_account', 'wallet', 'provider_account']),
    currency: currencyCodeSchema,
    encryptedDetailsReference: shortTextSchema.max(
      255,
      'Destination reference must be 255 characters or fewer.'
    ),
    isDefault: z.boolean().default(false),
  })
  .strict();

export const payoutRequestSchema = z
  .object({
    walletAccountId: uuidSchema,
    payoutDestinationId: uuidSchema,
    currency: currencyCodeSchema,
    requestedAmount: positiveAmountSchema,
    requestedByUserId: uuidSchema,
    idempotencyKey: z
      .string()
      .trim()
      .min(16)
      .max(255)
      .regex(/^[A-Za-z0-9._:-]+$/u, 'Idempotency key contains invalid characters.'),
  })
  .strict();

export const payoutReviewSchema = z
  .object({
    payoutRequestId: uuidSchema,
    decision: z.enum(['approve', 'reject']),
    reviewerNotes: optionalReviewNotesSchema,
  })
  .strict();

const planLimitsSchema = z
  .object({
    maxClients: z.number().int().nonnegative().nullable(),
    maxInvoicesPerMonth: z.number().int().nonnegative().nullable(),
    maxStaffSeats: z.number().int().nonnegative().nullable(),
    maxStorageMb: z.number().int().nonnegative().nullable(),
    maxWhatsAppMessagesPerMonth: z.number().int().nonnegative().nullable(),
    allowsCustomBranding: z.boolean(),
    allowsApiAccess: z.boolean(),
    allowsMultiCurrency: z.boolean(),
  })
  .strict();

export const planCreateSchema = z
  .object({
    tierId: z.enum(['free', 'starter', 'professional', 'business', 'enterprise']),
    name: shortTextSchema.max(160, 'Plan name must be 160 characters or fewer.'),
    monthlyPrice: moneySchema,
    yearlyPrice: moneySchema,
    limits: planLimitsSchema,
    isPubliclyVisible: z.boolean(),
    sortOrder: z.number().int().nonnegative().max(10_000),
  })
  .strict();

export const subscriptionChangeSchema = z
  .object({
    planId: uuidSchema,
    billingCycle: z.enum(['monthly', 'yearly']),
    couponCode: z.string().trim().toUpperCase().max(64).nullable().optional(),
  })
  .strict();

const cmsPageShape = {
  slug: slugSchema,
  title: shortTextSchema.max(255, 'Page title must be 255 characters or fewer.'),
  excerpt: z
    .string()
    .trim()
    .max(500, 'Excerpt must be 500 characters or fewer.')
    .nullable()
    .optional(),
  body: longTextSchema.max(500_000, 'Page body must be 500,000 characters or fewer.'),
  seoTitle: z
    .string()
    .trim()
    .max(255, 'SEO title must be 255 characters or fewer.')
    .nullable()
    .optional(),
  seoDescription: z
    .string()
    .trim()
    .max(320, 'SEO description must be 320 characters or fewer.')
    .nullable()
    .optional(),
  isPublished: z.boolean().default(false),
};

export const cmsPageCreateSchema = z.object(cmsPageShape).strict();
export const cmsPageUpdateSchema = z.object({ ...cmsPageShape, id: uuidSchema }).strict();

export const cmsRevisionPublishSchema = z
  .object({ pageId: uuidSchema, revisionId: uuidSchema, publishedAt: isoDateTimeSchema })
  .strict();

export const blogCategoryCreateSchema = z
  .object({
    name: shortTextSchema.max(120, 'Category name must be 120 characters or fewer.'),
    slug: slugSchema,
    description: optionalReviewNotesSchema,
  })
  .strict();

const blogPostShape = {
  categoryId: uuidSchema.nullable().optional(),
  title: shortTextSchema.max(255, 'Post title must be 255 characters or fewer.'),
  slug: slugSchema,
  excerpt: z
    .string()
    .trim()
    .max(500, 'Excerpt must be 500 characters or fewer.')
    .nullable()
    .optional(),
  body: longTextSchema.max(500_000, 'Post body must be 500,000 characters or fewer.'),
  coverProviderFileId: z
    .string()
    .trim()
    .max(255, 'Cover reference must be 255 characters or fewer.')
    .nullable()
    .optional(),
  seoTitle: z
    .string()
    .trim()
    .max(255, 'SEO title must be 255 characters or fewer.')
    .nullable()
    .optional(),
  seoDescription: z
    .string()
    .trim()
    .max(320, 'SEO description must be 320 characters or fewer.')
    .nullable()
    .optional(),
  publishedAt: isoDateTimeSchema.nullable().optional(),
};

export const blogPostCreateSchema = z.object(blogPostShape).strict();
export const blogPostUpdateSchema = z.object({ ...blogPostShape, id: uuidSchema }).strict();

export const faqCreateSchema = z
  .object({
    question: shortTextSchema.max(500, 'Question must be 500 characters or fewer.'),
    answer: longTextSchema.max(20_000, 'Answer must be 20,000 characters or fewer.'),
    category: shortTextSchema
      .max(120, 'FAQ category must be 120 characters or fewer.')
      .nullable()
      .optional(),
    sortOrder: z.number().int().nonnegative().max(100_000),
    isPublished: z.boolean().default(false),
  })
  .strict();

export const faqUpdateSchema = z.object({ ...faqCreateSchema.shape, id: uuidSchema }).strict();

export const seoRedirectSchema = z
  .object({
    fromPath: z
      .string()
      .trim()
      .regex(/^\/[a-z0-9/_-]*$/u, 'Source path is invalid.'),
    toUrl: urlSchema,
    statusCode: z.enum(['301', '302']),
  })
  .strict();

export const legalDocumentAcceptanceSchema = z
  .object({
    documentType: z.enum(['terms', 'privacy', 'cookie_policy', 'acceptable_use']),
    documentVersion: shortTextSchema.max(64, 'Document version must be 64 characters or fewer.'),
    acceptedAt: isoDateTimeSchema,
  })
  .strict();

export const taxAddressSchema = z
  .object({
    line1: shortTextSchema,
    line2: z.string().trim().max(255).optional(),
    city: shortTextSchema,
    stateOrProvince: shortTextSchema,
    postalCode: shortTextSchema,
    countryCode: countryCodeSchema,
  })
  .strict();
