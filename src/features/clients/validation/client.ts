// src/features/clients/validation/client.ts
// The one definition of what a valid client looks like. Both the form and the
// server actions read these rules, so the browser and the server agree.

import { z } from 'zod';

import {
  countryCodeSchema,
  currencyCodeSchema,
  emailSchema,
  isoDateSchema,
  moneySchema,
  phoneSchema,
  urlSchema,
  uuidSchema,
} from '@/lib/validation/primitives';
import { ADDRESS_TYPES, CLIENT_STATUSES, CLIENT_TYPES, MESSAGE_CHANNELS } from '@/types/enums';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const optionalEmail = z
  .union([emailSchema, z.literal('')])
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const optionalPhone = z
  .union([phoneSchema, z.literal('')])
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const optionalUrl = z
  .union([urlSchema, z.literal('')])
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const optionalCurrency = z
  .union([currencyCodeSchema, z.literal('')])
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const optionalCountry = z
  .union([countryCodeSchema, z.literal('')])
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const optionalMoney = z
  .union([moneySchema, z.literal('')])
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value));

const optionalPercentage = z
  .union([
    z
      .string()
      .trim()
      .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Enter a percentage with up to two decimal places.')
      .refine(
        (value) => Number.parseFloat(value) <= 100,
        'A percentage cannot be above one hundred.'
      ),
    z.literal(''),
  ])
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value));

const checkboxSchema = z
  .union([z.boolean(), z.literal('on'), z.literal('true'), z.literal('false'), z.literal('')])
  .optional()
  .transform((value) => value === true || value === 'on' || value === 'true');

export const clientAddressSchema = z.object({
  addressType: z.enum(ADDRESS_TYPES).default('billing'),
  addressLine1: z.string().trim().min(1, 'Enter the street address.').max(200),
  addressLine2: optionalText(200),
  city: optionalText(120),
  stateRegion: optionalText(120),
  postalCode: optionalText(40),
  countryCode: countryCodeSchema,
});

export const clientBaseSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Enter a client name.')
    .max(160, 'Keep the client name under 160 characters.'),
  clientType: z.enum(CLIENT_TYPES).default('business'),
  status: z.enum(CLIENT_STATUSES).default('active'),
  legalName: optionalText(200),
  contactPerson: optionalText(160),
  email: optionalEmail,
  phone: optionalPhone,
  mobile: optionalPhone,
  website: optionalUrl,
  billingCurrency: optionalCurrency,
  defaultPaymentTermsDays: z.coerce
    .number()
    .int('Payment terms must be a whole number of days.')
    .min(0)
    .max(365)
    .optional(),
  creditLimit: optionalMoney,
  lateFeePercentage: optionalPercentage,
  taxId: optionalText(60),
  vatNumber: optionalText(60),
  registrationNumber: optionalText(60),
  countryCode: optionalCountry,
  isTaxExempt: checkboxSchema,
  taxExemptionReason: optionalText(200),
  appliesReverseCharge: checkboxSchema,
  preferredContactChannel: z.enum(MESSAGE_CHANNELS).default('email'),
  sendReminders: checkboxSchema,
  statementDeliveryEnabled: checkboxSchema,
  portalNotes: optionalText(2000),
  internalNotes: optionalText(2000),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(120),
  stateRegion: optionalText(120),
  postalCode: optionalText(40),
});

/**
 * Reports a missing exemption reason when the client is marked tax exempt.
 *
 * @param value Parsed client values.
 * @param context Refinement context collecting the issue.
 * @returns Nothing.
 */
function checkTaxExemption(
  value: { isTaxExempt: boolean; taxExemptionReason: string | null },
  context: z.RefinementCtx
): void {
  if (value.isTaxExempt && value.taxExemptionReason === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['taxExemptionReason'],
      message: 'Give the reason this client is tax exempt.',
    });
  }
}

export const createClientSchema = clientBaseSchema.superRefine(checkTaxExemption);

export const updateClientSchema = clientBaseSchema
  .extend({ clientId: uuidSchema })
  .superRefine(checkTaxExemption);

export const clientIdSchema = z.object({ clientId: uuidSchema });

export const clientListFiltersSchema = z.object({
  search: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  status: z
    .union([z.enum(CLIENT_STATUSES), z.literal('all'), z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' || value === 'all' ? null : value)),
  includeDeleted: z
    .union([z.literal('1'), z.literal('0'), z.literal('')])
    .optional()
    .transform((value) => value === '1'),
  invoicedSince: isoDateSchema.optional(),
});

export type ClientFormValues = z.infer<typeof clientBaseSchema>;
export type ClientFormInput = z.input<typeof clientBaseSchema>;
export type CreateClientInput = z.input<typeof createClientSchema>;
export type UpdateClientInput = z.input<typeof updateClientSchema>;
