import { z } from 'zod';
import { countryCodeSchema, currencyCodeSchema, shortTextSchema } from './common';

export const onboardingPlanSchema = z
  .object({
    planTierId: z
      .enum(['free', 'starter', 'professional', 'business', 'enterprise'])
      .default('free'),
  })
  .strict();

export const onboardingCompanySchema = z
  .object({
    companyName: shortTextSchema.max(160, 'Company name must be 160 characters or fewer.'),
    industry: z.enum([
      'service',
      'retail',
      'medical',
      'professional_services',
      'ecommerce',
      'other',
    ]),
    defaultCountry: countryCodeSchema,
    defaultCurrency: currencyCodeSchema,
  })
  .strict();

export const onboardingInvoiceSchema = z
  .object({
    invoicePrefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{1,16}$/u, 'Invoice prefix is invalid.'),
    paymentTermsDays: z.number().int().min(0).max(3650).default(30),
    requireEmailOtpForClientLinks: z.boolean().default(false),
  })
  .strict();

export const onboardingSchema = onboardingPlanSchema
  .merge(onboardingCompanySchema)
  .merge(onboardingInvoiceSchema);
