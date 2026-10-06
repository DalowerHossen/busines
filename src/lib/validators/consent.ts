import { z } from 'zod';
import {
  countryCodeSchema,
  ipAddressSchema,
  isoDateTimeSchema,
  longTextSchema,
  shortTextSchema,
  uuidSchema,
} from './common';

const optionalSnapshotText = z
  .string()
  .trim()
  .max(100_000, 'Snapshot text must be 100,000 characters or fewer.')
  .optional();
const optionalVersion = shortTextSchema
  .max(64, 'Version must be 64 characters or fewer.')
  .optional();

export const paymentConsentSchema = z
  .object({
    companyId: uuidSchema,
    documentType: z.enum(['invoice', 'estimate']),
    documentId: uuidSchema,
    clientId: uuidSchema,
    consentCheckboxAccepted: z.literal(true, {
      errorMap: () => ({ message: 'Consent is required before payment.' }),
    }),
    receivedGoodsOrServicesConfirmed: z.literal(true, {
      errorMap: () => ({ message: 'Confirm that the goods or services were received.' }),
    }),
    invoiceDetailsReadConfirmed: z.literal(true, {
      errorMap: () => ({ message: 'Confirm that the invoice details were reviewed.' }),
    }),
    consentTextSnapshot: longTextSchema.max(
      100_000,
      'Consent text must be 100,000 characters or fewer.'
    ),
    termsVersion: optionalVersion,
    termsTextSnapshot: optionalSnapshotText,
    refundPolicyVersion: optionalVersion,
    refundPolicyTextSnapshot: optionalSnapshotText,
    consentedAt: isoDateTimeSchema,
    ipAddress: ipAddressSchema.optional(),
    geoCountryCode: countryCodeSchema.optional(),
    geoRegion: z.string().trim().max(120, 'Region must be 120 characters or fewer.').optional(),
    geoCity: z.string().trim().max(120, 'City must be 120 characters or fewer.').optional(),
    userAgent: z
      .string()
      .trim()
      .max(1_000, 'User agent must be 1,000 characters or fewer.')
      .optional(),
    deviceFingerprint: z
      .string()
      .trim()
      .max(512, 'Device fingerprint must be 512 characters or fewer.')
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.termsVersion !== undefined && value.termsTextSnapshot === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['termsTextSnapshot'],
        message: 'Terms text is required when a terms version is supplied.',
      });
    }
    if (value.termsTextSnapshot !== undefined && value.termsVersion === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['termsVersion'],
        message: 'Terms version is required when terms text is supplied.',
      });
    }
    if (value.refundPolicyVersion !== undefined && value.refundPolicyTextSnapshot === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['refundPolicyTextSnapshot'],
        message: 'Refund policy text is required when a refund policy version is supplied.',
      });
    }
    if (value.refundPolicyTextSnapshot !== undefined && value.refundPolicyVersion === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['refundPolicyVersion'],
        message: 'Refund policy version is required when refund policy text is supplied.',
      });
    }
  });

export const consentRecordHashSchema = z
  .object({
    recordHash: z
      .string()
      .trim()
      .regex(/^[0-9a-f]{64}$/iu, 'Consent record hash is invalid.'),
  })
  .strict();

export const cookieConsentSchema = z
  .object({
    necessary: z.literal(true),
    analytics: z.boolean(),
    marketing: z.boolean(),
    consentedAt: isoDateTimeSchema,
    policyVersion: shortTextSchema.max(64, 'Policy version must be 64 characters or fewer.'),
  })
  .strict();

export const communicationConsentSchema = z
  .object({
    clientId: uuidSchema,
    channel: z.enum(['email', 'sms', 'whatsapp', 'telegram', 'viber']),
    optedIn: z.boolean(),
    consentedAt: isoDateTimeSchema,
    source: shortTextSchema.max(120, 'Consent source must be 120 characters or fewer.'),
  })
  .strict();
