import { z } from 'zod';
import {
  currencyCodeSchema,
  emailSchema,
  idempotencyKeySchema,
  isoDateTimeSchema,
  longTextSchema,
  mimeTypeSchema,
  positiveAmountSchema,
  shortTextSchema,
  slugSchema,
  urlSchema,
  uuidSchema,
} from './common';
import { gatewayIdSchema } from './payment';

export const whatsappTemplateParameterSchema = z
  .object({
    type: z.literal('text'),
    text: shortTextSchema.max(4_096, 'Template parameter must be 4,096 characters or fewer.'),
  })
  .strict();

export const whatsappTemplateComponentSchema = z
  .object({
    type: z.enum(['header', 'body', 'button']),
    subType: z.enum(['quick_reply', 'url']).optional(),
    index: z
      .string()
      .trim()
      .regex(/^[0-9]+$/u, 'Button index is invalid.')
      .optional(),
    parameters: z
      .array(whatsappTemplateParameterSchema)
      .max(20, 'A template cannot contain more than 20 parameters.'),
  })
  .strict();

export const whatsappTemplateSendSchema = z
  .object({
    recipient: shortTextSchema.max(64, 'Recipient address must be 64 characters or fewer.'),
    body: shortTextSchema.max(4_096, 'Message body must be 4,096 characters or fewer.'),
    idempotencyKey: idempotencyKeySchema,
    templateName: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]+$/u, 'Template name is invalid.'),
    languageCode: z
      .string()
      .trim()
      .regex(/^[a-z]{2,3}(?:_[A-Z]{2})?$/u, 'Language code is invalid.'),
    components: z.array(whatsappTemplateComponentSchema).max(10).optional(),
  })
  .strict();

export const communicationMessageSchema = z
  .object({
    channel: z.enum(['whatsapp', 'sms', 'telegram', 'viber', 'email']),
    recipient: shortTextSchema.max(320, 'Recipient address must be 320 characters or fewer.'),
    body: shortTextSchema.max(10_000, 'Message body must be 10,000 characters or fewer.'),
    idempotencyKey: idempotencyKeySchema,
    statusCallbackUrl: urlSchema.optional(),
  })
  .strict();

export const apiKeyCreateSchema = z
  .object({
    name: shortTextSchema.max(120, 'API key name must be 120 characters or fewer.'),
    scopes: z
      .array(
        z
          .string()
          .trim()
          .regex(/^[a-z][a-z0-9_.:-]*$/u, 'API scope is invalid.')
      )
      .min(1)
      .max(100),
    expiresAt: isoDateTimeSchema.nullable().optional(),
  })
  .strict();

export const apiKeyRevokeSchema = z
  .object({
    apiKeyId: uuidSchema,
    reason: shortTextSchema.max(1_000, 'Reason must be 1,000 characters or fewer.'),
  })
  .strict();

export const apiKeyRotateSchema = z
  .object({
    apiKeyId: uuidSchema,
    expiresAt: isoDateTimeSchema.nullable().optional(),
  })
  .strict();

export const webhookEndpointCreateSchema = z
  .object({
    name: shortTextSchema.max(120, 'Webhook name must be 120 characters or fewer.'),
    endpointUrl: z
      .string()
      .trim()
      .url('Enter a valid webhook URL.')
      .refine((value) => new URL(value).protocol === 'https:', 'Webhook URL must use HTTPS.'),
    eventTypes: z
      .array(
        z
          .string()
          .trim()
          .regex(/^[a-z][a-z0-9_.:-]*$/u, 'Webhook event type is invalid.')
      )
      .min(1)
      .max(100),
    isActive: z.boolean().default(true),
  })
  .strict();

export const webhookEndpointUpdateSchema = z
  .object({ ...webhookEndpointCreateSchema.shape, id: uuidSchema })
  .strict();

export const webhookDeliveryReplaySchema = z
  .object({
    endpointId: uuidSchema,
    deliveryId: uuidSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const ecommerceConnectionCreateSchema = z
  .object({
    platform: z.enum(['shopify', 'woocommerce']),
    displayName: shortTextSchema.max(160, 'Connection name must be 160 characters or fewer.'),
    storeUrl: urlSchema,
    isActive: z.boolean().default(true),
  })
  .strict();

export const ecommerceAuthorizationSchema = z
  .object({
    connectionId: uuidSchema,
    authorizationCode: z
      .string()
      .trim()
      .min(1, 'Authorization code is required.')
      .max(4_096, 'Authorization code is invalid.'),
    state: z
      .string()
      .trim()
      .min(16, 'Authorization state is invalid.')
      .max(512, 'Authorization state is invalid.'),
  })
  .strict();

export const ecommerceSyncSchema = z
  .object({
    connectionId: uuidSchema,
    cursor: z.string().trim().max(1_000, 'Cursor is invalid.').nullable().optional(),
    updatedAfter: isoDateTimeSchema.optional(),
    pageSize: z.number().int().min(1).max(250).default(50),
  })
  .strict();

export const ecommerceWebhookRequestSchema = z
  .object({
    rawBody: z
      .string()
      .min(1, 'Webhook body is required.')
      .max(10_000_000, 'Webhook body is too large.'),
    headers: z.record(z.string().max(1_000).nullable()),
  })
  .strict();

export const hostedCheckoutSessionSchema = z
  .object({
    idempotencyKey: idempotencyKeySchema,
    currency: currencyCodeSchema,
    lineItems: z
      .array(
        z
          .object({
            externalProductId: shortTextSchema.max(
              255,
              'Product reference must be 255 characters or fewer.'
            ),
            externalVariantId: shortTextSchema
              .max(255, 'Variant reference must be 255 characters or fewer.')
              .optional(),
            name: shortTextSchema.max(255, 'Item name must be 255 characters or fewer.'),
            quantity: positiveAmountSchema,
            unitAmount: positiveAmountSchema,
          })
          .strict()
      )
      .min(1)
      .max(500),
    successUrl: urlSchema,
    cancelUrl: urlSchema,
    customerEmail: emailSchema.optional(),
  })
  .strict();

export const directCheckoutKeyCreateSchema = z
  .object({
    name: shortTextSchema.max(120, 'Key name must be 120 characters or fewer.'),
    allowedOrigins: z.array(z.string().trim().url('Enter a valid origin URL.')).max(50),
    expiresAt: isoDateTimeSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    for (const [index, origin] of value.allowedOrigins.entries()) {
      if (new URL(origin).pathname !== '/' || new URL(origin).search || new URL(origin).hash) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['allowedOrigins', index],
          message: 'Origin must not include a path, query, or hash.',
        });
      }
    }
  });

export const customDomainAddSchema = z
  .object({
    hostname: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u,
        'Enter a valid custom domain.'
      ),
    companyId: uuidSchema,
  })
  .strict();

export const customDomainVerificationSchema = z
  .object({
    domainId: uuidSchema,
    verificationMethod: z.enum(['dns_txt', 'dns_cname']),
  })
  .strict();

export const emailTemplateCreateSchema = z
  .object({
    templateKey: slugSchema,
    subjectTemplate: shortTextSchema.max(255, 'Subject template must be 255 characters or fewer.'),
    bodyHtmlTemplate: longTextSchema.max(
      100_000,
      'HTML template must be 100,000 characters or fewer.'
    ),
    bodyTextTemplate: longTextSchema.max(
      100_000,
      'Text template must be 100,000 characters or fewer.'
    ),
    variableNames: z
      .array(
        z
          .string()
          .trim()
          .regex(/^[a-z][a-zA-Z0-9_.]*$/u, 'Template variable is invalid.')
      )
      .max(100),
  })
  .strict();

export const emailTemplateUpdateSchema = z
  .object({ ...emailTemplateCreateSchema.shape, id: uuidSchema })
  .strict();

export const emailSendSchema = z
  .object({
    to: z.array(emailSchema).min(1, 'Add at least one recipient.').max(100),
    subject: shortTextSchema.max(255, 'Subject must be 255 characters or fewer.'),
    html: longTextSchema.max(100_000, 'HTML body must be 100,000 characters or fewer.'),
    text: longTextSchema.max(100_000, 'Text body must be 100,000 characters or fewer.'),
    from: emailSchema.optional(),
    replyTo: emailSchema.optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const gatewayConfigSchema = z
  .object({
    gateway: gatewayIdSchema,
    isEnabled: z.boolean(),
    cardPaymentsEnabled: z.boolean(),
    recurringBillingEnabled: z.boolean(),
    payoutEnabled: z.boolean(),
    encryptedSecretReference: z
      .string()
      .trim()
      .max(255, 'Secret reference must be 255 characters or fewer.')
      .nullable()
      .optional(),
    publicConfiguration: z
      .record(z.string().trim().max(128), z.string().trim().max(2_000))
      .default({}),
  })
  .strict();

export const gatewayCompanyOverrideSchema = z
  .object({
    gateway: gatewayIdSchema,
    companyId: uuidSchema,
    isEnabled: z.boolean(),
    cardPaymentsEnabled: z.boolean(),
  })
  .strict();

export const gatewayTestSchema = z
  .object({ gateway: gatewayIdSchema, idempotencyKey: idempotencyKeySchema })
  .strict();

export const providerFileMetadataSchema = z
  .object({
    providerFileId: shortTextSchema.max(255, 'File reference must be 255 characters or fewer.'),
    fileName: shortTextSchema.max(255, 'File name must be 255 characters or fewer.'),
    mimeType: mimeTypeSchema,
    sizeBytes: z.number().int().positive().max(100_000_000, 'File cannot exceed 100 MB.'),
  })
  .strict();
