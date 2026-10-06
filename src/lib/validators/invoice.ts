import { z } from 'zod';
import {
  addressSchema,
  currencyCodeSchema,
  dateOrderSchema,
  isoDateTimeSchema,
  longTextSchema,
  moneySchema,
  optionalTextSchema,
  percentageSchema,
  positiveAmountSchema,
  shortTextSchema,
  uuidSchema,
} from './common';

const lineItemShape = {
  productId: uuidSchema.nullable().optional(),
  description: shortTextSchema.max(1_000, 'Description must be 1,000 characters or fewer.'),
  quantity: positiveAmountSchema,
  unitPrice: moneySchema,
  taxRatePercent: percentageSchema.nullable().optional(),
  discountPercent: percentageSchema.nullable().optional(),
};

export const invoiceLineItemSchema = z.object(lineItemShape).strict();

const invoiceDocumentShape = {
  clientId: uuidSchema,
  issueDate: isoDateTimeSchema,
  dueDate: isoDateTimeSchema,
  currency: currencyCodeSchema,
  lineItems: z
    .array(invoiceLineItemSchema)
    .min(1, 'Add at least one line item.')
    .max(500, 'An invoice cannot contain more than 500 line items.'),
  notes: optionalTextSchema,
  internalNotes: optionalTextSchema,
  templateId: uuidSchema.nullable().optional(),
};

export const invoiceCreateSchema = dateOrderSchema(
  z.object(invoiceDocumentShape).strict(),
  'issueDate',
  'dueDate',
  'Due date cannot be earlier than the issue date.'
);

export const invoiceUpdateSchema = dateOrderSchema(
  z
    .object({
      ...invoiceDocumentShape,
      id: uuidSchema,
    })
    .strict(),
  'issueDate',
  'dueDate',
  'Due date cannot be earlier than the issue date.'
);

export const invoiceSendSchema = z
  .object({
    invoiceId: uuidSchema,
    recipientEmail: z
      .string()
      .trim()
      .email('Enter a valid recipient email address.')
      .max(320, 'Email address must be 320 characters or fewer.'),
    message: z
      .string()
      .trim()
      .max(10_000, 'Message must be 10,000 characters or fewer.')
      .nullable()
      .optional(),
  })
  .strict();

export const invoiceVoidSchema = z
  .object({
    invoiceId: uuidSchema,
    reason: shortTextSchema.max(1_000, 'Reason must be 1,000 characters or fewer.'),
  })
  .strict();

const estimateDocumentShape = {
  clientId: uuidSchema,
  issueDate: isoDateTimeSchema,
  expiryDate: isoDateTimeSchema.nullable().optional(),
  currency: currencyCodeSchema,
  lineItems: z
    .array(invoiceLineItemSchema)
    .min(1, 'Add at least one line item.')
    .max(500, 'An estimate cannot contain more than 500 line items.'),
  notes: optionalTextSchema,
  templateId: uuidSchema.nullable().optional(),
};

export const estimateCreateSchema = z
  .object(estimateDocumentShape)
  .strict()
  .superRefine((value, context) => {
    if (
      value.expiryDate !== undefined &&
      value.expiryDate !== null &&
      Date.parse(value.expiryDate) < Date.parse(value.issueDate)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiryDate'],
        message: 'Expiry date cannot be earlier than the issue date.',
      });
    }
  });

export const estimateUpdateSchema = z
  .object({ ...estimateDocumentShape, id: uuidSchema })
  .strict()
  .superRefine((value, context) => {
    if (
      value.expiryDate !== undefined &&
      value.expiryDate !== null &&
      Date.parse(value.expiryDate) < Date.parse(value.issueDate)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiryDate'],
        message: 'Expiry date cannot be earlier than the issue date.',
      });
    }
  });

export const estimateApproveSchema = z
  .object({
    estimateId: uuidSchema,
    dueDate: isoDateTimeSchema,
    templateId: uuidSchema.nullable().optional(),
  })
  .strict();

const recurringInvoiceShape = {
  clientId: uuidSchema,
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
  nextRunDate: isoDateTimeSchema,
  endDate: isoDateTimeSchema.nullable().optional(),
  currency: currencyCodeSchema,
  lineItems: z
    .array(invoiceLineItemSchema)
    .min(1, 'Add at least one line item.')
    .max(500, 'A recurring invoice cannot contain more than 500 line items.'),
  isActive: z.boolean().default(true),
};

export const recurringInvoiceCreateSchema = z
  .object(recurringInvoiceShape)
  .strict()
  .superRefine((value, context) => {
    if (
      value.endDate !== undefined &&
      value.endDate !== null &&
      Date.parse(value.endDate) < Date.parse(value.nextRunDate)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'End date cannot be earlier than the next run date.',
      });
    }
  });

export const recurringInvoiceUpdateSchema = z
  .object({ ...recurringInvoiceShape, id: uuidSchema })
  .strict()
  .superRefine((value, context) => {
    if (
      value.endDate !== undefined &&
      value.endDate !== null &&
      Date.parse(value.endDate) < Date.parse(value.nextRunDate)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'End date cannot be earlier than the next run date.',
      });
    }
  });

const noteShape = {
  invoiceId: uuidSchema,
  reason: shortTextSchema.max(1_000, 'Reason must be 1,000 characters or fewer.'),
  issueDate: isoDateTimeSchema,
  currency: currencyCodeSchema,
  lineItems: z
    .array(invoiceLineItemSchema)
    .min(1, 'Add at least one line item.')
    .max(500, 'A note cannot contain more than 500 line items.'),
};

export const creditNoteCreateSchema = z.object(noteShape).strict();
export const debitNoteCreateSchema = z.object(noteShape).strict();

export const clientAccessTokenRequestSchema = z
  .object({
    documentType: z.enum(['invoice', 'estimate', 'client_hub']),
    documentId: uuidSchema.nullable().optional(),
    clientId: uuidSchema,
    requiresEmailOtp: z.boolean().default(false),
    expiresAt: isoDateTimeSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.documentType === 'client_hub' &&
      value.documentId !== undefined &&
      value.documentId !== null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documentId'],
        message: 'A client hub link does not accept a document ID.',
      });
    }
    if (value.documentType !== 'client_hub' && !value.documentId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documentId'],
        message: 'A document ID is required for this link.',
      });
    }
  });

export const clientAccessOtpSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(32, 'Access token is invalid.')
      .max(4096, 'Access token is invalid.'),
    code: z
      .string()
      .trim()
      .regex(/^[0-9]{6}$/u, 'Enter the six-digit verification code.'),
  })
  .strict();

export const invoiceProfileSnapshotSchema = z
  .object({
    companyName: shortTextSchema.max(160, 'Company name must be 160 characters or fewer.'),
    logoProviderFileId: z
      .string()
      .trim()
      .max(255, 'Logo reference must be 255 characters or fewer.')
      .nullable(),
    address: addressSchema,
    taxId: z.string().trim().max(128, 'Tax ID must be 128 characters or fewer.').nullable(),
    email: z
      .string()
      .trim()
      .email('Enter a valid company email address.')
      .max(320, 'Email address must be 320 characters or fewer.'),
    phone: z.string().trim().max(64, 'Phone number must be 64 characters or fewer.').nullable(),
  })
  .strict();

export const invoiceClientSnapshotSchema = z
  .object({
    clientId: uuidSchema,
    displayName: shortTextSchema.max(160, 'Display name must be 160 characters or fewer.'),
    email: z
      .string()
      .trim()
      .email('Enter a valid client email address.')
      .max(320, 'Email address must be 320 characters or fewer.'),
    billingAddress: addressSchema.nullable(),
  })
  .strict();

export const invoiceCommentSchema = z
  .object({
    invoiceId: uuidSchema,
    body: longTextSchema,
  })
  .strict();
