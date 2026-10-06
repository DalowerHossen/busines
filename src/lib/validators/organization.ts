import { z } from 'zod';
import {
  addressSchema,
  countryCodeSchema,
  currencyCodeSchema,
  emailSchema,
  hexColorSchema,
  isoDateTimeSchema,
  longTextSchema,
  optionalTextSchema,
  shortTextSchema,
  slugSchema,
  urlSchema,
  uuidSchema,
} from './common';

export const staffPermissionSchema = z.enum([
  'manage_clients',
  'manage_products',
  'manage_invoices',
  'manage_estimates',
  'manage_expenses',
  'manage_inventory',
  'view_reports',
  'request_send_client_email',
]);

export const teamMemberUpdateSchema = z
  .object({
    membershipId: uuidSchema,
    role: z.enum(['staff', 'affiliate']),
    permissions: z.array(staffPermissionSchema).max(32, 'Too many permissions selected.'),
    isActive: z.boolean(),
  })
  .strict();

export const accountantCompanyAccessCreateSchema = z
  .object({ accountantUserId: uuidSchema })
  .strict();

export const teamMemberRemoveSchema = z
  .object({
    membershipId: uuidSchema,
    reason: shortTextSchema.max(1_000, 'Reason must be 1,000 characters or fewer.'),
  })
  .strict();

export const teamPermissionPresetSchema = z
  .object({
    name: shortTextSchema.max(120, 'Preset name must be 120 characters or fewer.'),
    permissions: z.array(staffPermissionSchema).min(1, 'Select at least one permission.').max(32),
  })
  .strict();

export const companyProfileUpdateSchema = z
  .object({
    name: shortTextSchema.max(160, 'Company name must be 160 characters or fewer.'),
    slug: slugSchema,
    legalName: shortTextSchema.max(255, 'Legal name must be 255 characters or fewer.'),
    email: emailSchema,
    phone: z.string().trim().max(64, 'Phone number must be 64 characters or fewer.').nullable(),
    address: addressSchema,
    taxId: z.string().trim().max(128, 'Tax ID must be 128 characters or fewer.').nullable(),
    defaultCurrency: currencyCodeSchema,
    defaultCountry: countryCodeSchema,
    invoicePrefix: z
      .string()
      .trim()
      .regex(/^[A-Z0-9-]{1,16}$/u, 'Invoice prefix is invalid.'),
    website: urlSchema.nullable(),
  })
  .strict();

export const companyLogoUpdateSchema = z
  .object({
    providerFileId: shortTextSchema.max(255, 'Logo reference must be 255 characters or fewer.'),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    sizeBytes: z.number().int().positive().max(5_000_000, 'Logo file cannot exceed 5 MB.'),
  })
  .strict();

export const brandingSettingsSchema = z
  .object({
    companyName: shortTextSchema.max(160, 'Company name must be 160 characters or fewer.'),
    logoProviderFileId: z
      .string()
      .trim()
      .max(255, 'Logo reference must be 255 characters or fewer.')
      .nullable(),
    faviconProviderFileId: z
      .string()
      .trim()
      .max(255, 'Favicon reference must be 255 characters or fewer.')
      .nullable(),
    primaryColor: hexColorSchema,
    accentColor: hexColorSchema,
    backgroundColor: hexColorSchema,
    customDomain: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u,
        'Enter a valid custom domain.'
      )
      .nullable(),
  })
  .strict();

const timeZoneSchema = z
  .string()
  .trim()
  .min(1, 'Time zone is required.')
  .max(100, 'Time zone is invalid.')
  .refine((value) => {
    try {
      Intl.DateTimeFormat('en-US', { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, 'Enter a valid time zone.');

export const companyLocaleSettingsSchema = z
  .object({
    locale: z.enum(['en-US', 'en-GB', 'en-IN', 'en-AU']),
    timeZone: timeZoneSchema,
    dateFormat: z.enum(['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy']),
    firstDayOfWeek: z.enum(['sunday', 'monday']),
  })
  .strict();

export const invoiceSettingsSchema = z
  .object({
    invoicePrefix: z
      .string()
      .trim()
      .regex(/^[A-Z0-9-]{1,16}$/u, 'Invoice prefix is invalid.'),
    nextInvoiceNumber: z.number().int().min(1).max(9_999_999_999),
    paymentTermsDays: z.number().int().min(0).max(3650),
    requireEmailOtpForClientLinks: z.boolean(),
    defaultNotes: optionalTextSchema,
    defaultFooter: optionalTextSchema,
  })
  .strict();

export const notificationSettingsSchema = z
  .object({
    invoicePaidEmail: z.boolean(),
    paymentFailedEmail: z.boolean(),
    overdueReminderEmail: z.boolean(),
    teamActivityEmail: z.boolean(),
    inAppNotifications: z.boolean(),
  })
  .strict();

export const smtpSettingsSchema = z
  .object({
    host: shortTextSchema.max(255, 'SMTP host must be 255 characters or fewer.'),
    port: z.number().int().min(1).max(65_535),
    username: shortTextSchema.max(320, 'SMTP username must be 320 characters or fewer.'),
    password: z.string().max(1_000, 'SMTP password must be 1,000 characters or fewer.').optional(),
    fromEmail: emailSchema,
    fromName: shortTextSchema.max(160, 'Sender name must be 160 characters or fewer.'),
    encryption: z.enum(['tls', 'starttls', 'none']),
  })
  .strict();

export const systemSettingsSchema = z
  .object({
    locale: companyLocaleSettingsSchema,
    invoice: invoiceSettingsSchema,
    notifications: notificationSettingsSchema,
    smtp: smtpSettingsSchema.nullable().optional(),
  })
  .strict();

export const contactFormSchema = z
  .object({
    name: shortTextSchema.max(160, 'Name must be 160 characters or fewer.'),
    email: emailSchema,
    subject: shortTextSchema.max(255, 'Subject must be 255 characters or fewer.'),
    message: longTextSchema.max(10_000, 'Message must be 10,000 characters or fewer.'),
    consentToReply: z.literal(true, {
      errorMap: () => ({ message: 'Consent to reply is required.' }),
    }),
  })
  .strict();

export const publicContactTicketSchema = z
  .object({
    ticketId: uuidSchema,
    email: emailSchema,
    reply: longTextSchema.max(10_000, 'Reply must be 10,000 characters or fewer.'),
    attachmentProviderFileId: z
      .string()
      .trim()
      .max(255, 'Attachment reference must be 255 characters or fewer.')
      .nullable()
      .optional(),
  })
  .strict();

export const companyStatusSchema = z
  .object({
    companyId: uuidSchema,
    status: z.enum(['active', 'suspended']),
    reason: shortTextSchema.max(1_000, 'Reason must be 1,000 characters or fewer.'),
  })
  .strict();

export const companyProfileEffectiveDateSchema = z
  .object({ effectiveAt: isoDateTimeSchema })
  .strict();
