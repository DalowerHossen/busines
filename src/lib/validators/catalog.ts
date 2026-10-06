import Decimal from 'decimal.js';
import { z } from 'zod';
import {
  countryCodeSchema,
  currencyCodeSchema,
  isoDateTimeSchema,
  moneySchema,
  nonNegativeAmountSchema,
  optionalTextSchema,
  percentageSchema,
  positiveAmountSchema,
  shortTextSchema,
  uuidSchema,
} from './common';

const productShape = {
  type: z.enum(['product', 'service']),
  name: shortTextSchema.max(255, 'Product name must be 255 characters or fewer.'),
  sku: z.string().trim().max(128, 'SKU must be 128 characters or fewer.').nullable().optional(),
  description: optionalTextSchema,
  unitPrice: moneySchema,
  defaultTaxRatePercent: percentageSchema.nullable().optional(),
  categoryId: uuidSchema.nullable().optional(),
  trackInventory: z.boolean().default(false),
};

export const productCreateSchema = z
  .object(productShape)
  .strict()
  .superRefine((value, context) => {
    if (value.type === 'service' && value.trackInventory) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['trackInventory'],
        message: 'Services cannot track inventory.',
      });
    }
  });

export const productUpdateSchema = z
  .object({ ...productShape, id: uuidSchema, isArchived: z.boolean().optional() })
  .strict()
  .superRefine((value, context) => {
    if (value.type === 'service' && value.trackInventory) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['trackInventory'],
        message: 'Services cannot track inventory.',
      });
    }
  });

export const productCategoryCreateSchema = z
  .object({
    name: shortTextSchema.max(120, 'Category name must be 120 characters or fewer.'),
    parentCategoryId: uuidSchema.nullable().optional(),
  })
  .strict();

export const productCategoryUpdateSchema = z
  .object({ ...productCategoryCreateSchema.shape, id: uuidSchema })
  .strict();

export const productBundleCreateSchema = z
  .object({
    name: shortTextSchema.max(255, 'Bundle name must be 255 characters or fewer.'),
    bundlePrice: moneySchema,
    productIds: z
      .array(uuidSchema)
      .min(1, 'Add at least one product to the bundle.')
      .max(500, 'A bundle cannot contain more than 500 products.'),
  })
  .strict();

export const productBundleUpdateSchema = z
  .object({ ...productBundleCreateSchema.shape, id: uuidSchema })
  .strict();

export const expenseCategoryCreateSchema = z
  .object({
    name: shortTextSchema.max(120, 'Expense category name must be 120 characters or fewer.'),
    color: z
      .string()
      .trim()
      .regex(/^#[0-9A-F]{6}$/iu, 'Enter a valid hexadecimal color.')
      .nullable()
      .optional(),
  })
  .strict();

const expenseShape = {
  categoryId: uuidSchema.nullable().optional(),
  vendorName: shortTextSchema
    .max(255, 'Vendor name must be 255 characters or fewer.')
    .nullable()
    .optional(),
  description: shortTextSchema.max(2_000, 'Description must be 2,000 characters or fewer.'),
  amount: moneySchema,
  expenseDate: isoDateTimeSchema,
  receiptProviderFileId: shortTextSchema
    .max(255, 'Receipt reference must be 255 characters or fewer.')
    .nullable()
    .optional(),
  isBillableToClient: z.boolean().default(false),
  rebillClientId: uuidSchema.nullable().optional(),
};

export const expenseCreateSchema = z
  .object(expenseShape)
  .strict()
  .superRefine((value, context) => {
    if (value.isBillableToClient && !value.rebillClientId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rebillClientId'],
        message: 'Select a client for a billable expense.',
      });
    }
  });

export const expenseUpdateSchema = z
  .object({ ...expenseShape, id: uuidSchema })
  .strict()
  .superRefine((value, context) => {
    if (value.isBillableToClient && !value.rebillClientId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rebillClientId'],
        message: 'Select a client for a billable expense.',
      });
    }
  });

export const recurringExpenseCreateSchema = z
  .object({
    categoryId: uuidSchema.nullable().optional(),
    description: shortTextSchema.max(2_000, 'Description must be 2,000 characters or fewer.'),
    amount: moneySchema,
    frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
    nextRunDate: isoDateTimeSchema,
    endDate: isoDateTimeSchema.nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endDate && Date.parse(value.endDate) < Date.parse(value.nextRunDate)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'End date cannot be earlier than the next run date.',
      });
    }
  });

export const incomeCreateSchema = z
  .object({
    source: shortTextSchema.max(255, 'Income source must be 255 characters or fewer.'),
    category: shortTextSchema
      .max(120, 'Income category must be 120 characters or fewer.')
      .nullable()
      .optional(),
    description: optionalTextSchema,
    amount: moneySchema,
    incomeDate: isoDateTimeSchema,
    clientId: uuidSchema.nullable().optional(),
  })
  .strict();

export const taxRateCreateSchema = z
  .object({
    name: shortTextSchema.max(120, 'Tax rate name must be 120 characters or fewer.'),
    ratePercent: percentageSchema,
    countryCode: countryCodeSchema.nullable().optional(),
    stateCode: z
      .string()
      .trim()
      .max(32, 'State code must be 32 characters or fewer.')
      .nullable()
      .optional(),
    isCompound: z.boolean().default(false),
    isDefault: z.boolean().default(false),
  })
  .strict();

export const chartOfAccountCreateSchema = z
  .object({
    accountCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9._-]{1,32}$/u, 'Account code is invalid.'),
    accountName: shortTextSchema.max(160, 'Account name must be 160 characters or fewer.'),
    accountType: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
    parentAccountId: uuidSchema.nullable().optional(),
    description: optionalTextSchema,
  })
  .strict();

export const chartOfAccountUpdateSchema = z
  .object({ ...chartOfAccountCreateSchema.shape, id: uuidSchema, isActive: z.boolean() })
  .strict();

const journalLineSchema = z
  .object({
    accountId: uuidSchema,
    debitAmount: nonNegativeAmountSchema,
    creditAmount: nonNegativeAmountSchema,
    description: optionalTextSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const debit = new Decimal(value.debitAmount);
    const credit = new Decimal(value.creditAmount);
    if (debit.gt(0) === credit.gt(0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['debitAmount'],
        message: 'A journal line must contain either a debit or a credit.',
      });
    }
  });

export const journalEntryCreateSchema = z
  .object({
    currency: currencyCodeSchema,
    entryDate: isoDateTimeSchema,
    description: shortTextSchema.max(2_000, 'Description must be 2,000 characters or fewer.'),
    referenceType: shortTextSchema
      .max(64, 'Reference type must be 64 characters or fewer.')
      .optional(),
    referenceId: uuidSchema.optional(),
    lines: z
      .array(journalLineSchema)
      .min(2, 'A journal entry needs at least two lines.')
      .max(500, 'A journal entry cannot contain more than 500 lines.'),
  })
  .strict()
  .superRefine((value, context) => {
    const debit = value.lines.reduce((total, line) => total.plus(line.debitAmount), new Decimal(0));
    const credit = value.lines.reduce(
      (total, line) => total.plus(line.creditAmount),
      new Decimal(0)
    );
    if (!debit.eq(credit)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lines'],
        message: 'Total debits must equal total credits.',
      });
    }
  });

export const bankMatchingRuleCreateSchema = z
  .object({
    matchField: z.enum(['description', 'amount']),
    matchPattern: shortTextSchema.max(255, 'Match pattern must be 255 characters or fewer.'),
    targetCategoryId: uuidSchema.nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .strict();

export const bankReconciliationSchema = z
  .object({
    bankTransactionId: uuidSchema,
    candidateId: uuidSchema,
    candidateType: z.enum(['payment', 'expense', 'bill', 'income']),
    amount: nonNegativeAmountSchema,
  })
  .strict();

export const receiptOcrRequestSchema = z
  .object({
    providerFileId: shortTextSchema.max(255, 'File reference must be 255 characters or fewer.'),
    mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
    sizeBytes: z.number().int().positive().max(25_000_000, 'Receipt file cannot exceed 25 MB.'),
    contentSha256: z
      .string()
      .trim()
      .regex(/^[0-9a-f]{64}$/iu, 'Content hash is invalid.'),
  })
  .strict();

const warehouseShape = {
  name: shortTextSchema.max(160, 'Warehouse name must be 160 characters or fewer.'),
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_-]{1,32}$/u, 'Warehouse code is invalid.'),
  address: z
    .string()
    .trim()
    .max(1_000, 'Warehouse address must be 1,000 characters or fewer.')
    .nullable()
    .optional(),
};

export const warehouseCreateSchema = z.object(warehouseShape).strict();
export const warehouseUpdateSchema = z
  .object({ ...warehouseShape, id: uuidSchema, isActive: z.boolean() })
  .strict();

export const stockAdjustmentSchema = z
  .object({
    warehouseId: uuidSchema,
    productId: uuidSchema,
    quantity: nonNegativeAmountSchema,
    reason: shortTextSchema.max(1_000, 'Reason must be 1,000 characters or fewer.'),
  })
  .strict()
  .refine((value) => new Decimal(value.quantity).gt(0), {
    path: ['quantity'],
    message: 'Quantity must be greater than zero.',
  });

export const stockTransferCreateSchema = z
  .object({
    sourceWarehouseId: uuidSchema,
    destinationWarehouseId: uuidSchema,
    lines: z
      .array(z.object({ productId: uuidSchema, quantity: positiveAmountSchema }).strict())
      .min(1)
      .max(500),
    notes: optionalTextSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.sourceWarehouseId === value.destinationWarehouseId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destinationWarehouseId'],
        message: 'Choose a different destination warehouse.',
      });
    }
  });

const supplierShape = {
  legalName: shortTextSchema.max(255, 'Supplier name must be 255 characters or fewer.'),
  email: z
    .string()
    .trim()
    .email('Enter a valid supplier email address.')
    .max(320, 'Email address must be 320 characters or fewer.')
    .nullable()
    .optional(),
  phone: z
    .string()
    .trim()
    .max(64, 'Phone number must be 64 characters or fewer.')
    .nullable()
    .optional(),
  taxId: z
    .string()
    .trim()
    .max(128, 'Tax ID must be 128 characters or fewer.')
    .nullable()
    .optional(),
  currency: currencyCodeSchema,
  notes: optionalTextSchema,
};

export const supplierCreateSchema = z.object(supplierShape).strict();
export const supplierUpdateSchema = z.object({ ...supplierShape, id: uuidSchema }).strict();

const purchaseOrderLineSchema = z
  .object({
    productId: uuidSchema.nullable().optional(),
    description: shortTextSchema.max(1_000, 'Description must be 1,000 characters or fewer.'),
    quantity: positiveAmountSchema,
    unitPrice: moneySchema,
  })
  .strict();

export const purchaseOrderCreateSchema = z
  .object({
    supplierId: uuidSchema.nullable().optional(),
    orderNumber: shortTextSchema.max(64, 'Order number must be 64 characters or fewer.'),
    orderDate: isoDateTimeSchema,
    expectedDate: isoDateTimeSchema.nullable().optional(),
    currency: currencyCodeSchema,
    lines: z
      .array(purchaseOrderLineSchema)
      .min(1, 'Add at least one purchase-order line.')
      .max(500),
    notes: optionalTextSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.expectedDate && Date.parse(value.expectedDate) < Date.parse(value.orderDate)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expectedDate'],
        message: 'Expected date cannot be earlier than the order date.',
      });
    }
  });

export const purchaseOrderStatusSchema = z
  .object({
    purchaseOrderId: uuidSchema,
    status: z.enum(['draft', 'sent', 'partially_received', 'received', 'cancelled']),
  })
  .strict();

export const supplierPaymentTermsSchema = z
  .object({
    supplierId: uuidSchema,
    dueInDays: z.number().int().min(0).max(3650),
  })
  .strict();

export const inventoryQuantitySchema = z
  .object({
    productId: uuidSchema,
    warehouseId: uuidSchema,
    quantity: nonNegativeAmountSchema,
    unit: shortTextSchema.max(32, 'Unit must be 32 characters or fewer.'),
  })
  .strict();

export const inventoryImportSchema = z
  .object({
    rows: z.array(inventoryQuantitySchema).min(1).max(10_000),
  })
  .strict();

export const supplierAddressSchema = z
  .object({
    line1: shortTextSchema,
    city: shortTextSchema,
    state: shortTextSchema.nullable().optional(),
    postalCode: shortTextSchema.nullable().optional(),
    country: countryCodeSchema,
  })
  .strict();
