// src/features/products/validation/product.ts
// What a valid catalogue item looks like. The same rules run in the browser
// and on the server, so a price can never be saved in a shape the ledger
// cannot add up.

import { z } from 'zod';

import {
  currencyCodeSchema,
  moneySchema,
  shortTextSchema,
  uuidSchema,
} from '@/lib/validation/primitives';
import { PRODUCT_STATUSES, PRODUCT_TYPES } from '@/types/enums';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const optionalUuid = z
  .union([uuidSchema, z.literal('')])
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value));

const optionalMoney = z
  .union([moneySchema, z.literal('')])
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value));

const optionalQuantity = z
  .union([
    z
      .string()
      .trim()
      .regex(/^\d{1,11}(\.\d{1,3})?$/, 'Enter a quantity with up to three decimal places.'),
    z.literal(''),
  ])
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value));

const optionalCurrency = z
  .union([currencyCodeSchema, z.literal('')])
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const checkboxSchema = z
  .union([z.boolean(), z.literal('on'), z.literal('true'), z.literal('false'), z.literal('')])
  .optional()
  .transform((value) => value === true || value === 'on' || value === 'true');

export const productBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name for this item.')
    .max(200, 'Keep the name under 200 characters.'),
  sku: optionalText(60),
  barcode: optionalText(60),
  description: optionalText(2000),
  productType: z.enum(PRODUCT_TYPES).default('service'),
  status: z.enum(PRODUCT_STATUSES).default('active'),
  categoryId: optionalUuid,
  unitOfMeasureId: optionalUuid,
  unitPrice: moneySchema.refine(
    (value) => Number.parseFloat(value) >= 0,
    'A price cannot be negative.'
  ),
  currency: optionalCurrency,
  taxRateId: optionalUuid,
  isTaxInclusivePrice: checkboxSchema,
  allowPriceOverride: checkboxSchema,
  minimumPrice: optionalMoney,
  costPrice: optionalMoney,
  preferredSupplierName: optionalText(160),
  isBillableByTime: checkboxSchema,
  defaultHours: optionalQuantity,
  trackInventory: checkboxSchema,
  lowStockThreshold: optionalQuantity,
  openingStockQuantity: optionalQuantity,
  hsCode: optionalText(20),
  incomeAccountCode: optionalText(40),
  expenseAccountCode: optionalText(40),
  internalNotes: optionalText(2000),
  isFeatured: checkboxSchema,
});

interface ProductRules {
  productType: string;
  trackInventory: boolean;
  unitPrice: string;
  minimumPrice: string | null;
}

/**
 * Checks the rules the database enforces, so the person sees them in the form
 * rather than as a failed save.
 *
 * @param value Parsed item values.
 * @param context Refinement context collecting the issues.
 * @returns Nothing.
 */
function checkProductRules(value: ProductRules, context: z.RefinementCtx): void {
  if (value.trackInventory && value.productType !== 'goods') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['trackInventory'],
      message: 'Only goods can be tracked in stock. Change the type to goods first.',
    });
  }

  if (
    value.minimumPrice !== null &&
    Number.parseFloat(value.minimumPrice) > Number.parseFloat(value.unitPrice)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['minimumPrice'],
      message: 'The lowest price cannot be above the selling price.',
    });
  }
}

export const createProductSchema = productBaseSchema.superRefine(checkProductRules);

export const updateProductSchema = productBaseSchema
  .extend({ productId: uuidSchema })
  .superRefine(checkProductRules);

export const productIdSchema = z.object({ productId: uuidSchema });

export const setProductStatusSchema = z.object({
  productId: uuidSchema,
  status: z.enum(PRODUCT_STATUSES),
});

export const productCategorySchema = z.object({
  name: shortTextSchema.max(80, 'Keep the category name under 80 characters.'),
  description: optionalText(400),
});

export const productListFiltersSchema = z.object({
  search: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  status: z
    .union([z.enum(PRODUCT_STATUSES), z.literal('all'), z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' || value === 'all' ? null : value)),
  productType: z
    .union([z.enum(PRODUCT_TYPES), z.literal('all'), z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' || value === 'all' ? null : value)),
  categoryId: optionalUuid,
  includeDeleted: z
    .union([z.literal('1'), z.literal('0'), z.literal('')])
    .optional()
    .transform((value) => value === '1'),
});

export type ProductFormValues = z.infer<typeof productBaseSchema>;
export type CreateProductInput = z.input<typeof createProductSchema>;
export type UpdateProductInput = z.input<typeof updateProductSchema>;
