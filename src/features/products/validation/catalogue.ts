// src/features/products/validation/catalogue.ts
// Validation for bundles and client price lists. The database stores these
// records per company, while this module keeps their arithmetic and form
// constraints consistent before an action reaches the database.

import { z } from 'zod';

import {
  booleanFromFormSchema,
  currencyCodeSchema,
  optionalIsoDateSchema,
  optionalLongTextSchema,
  quantitySchema,
  shortTextSchema,
  uuidSchema,
} from '@/lib/validation/primitives';

const nonNegativeMoneySchema = z
  .string()
  .trim()
  .regex(/^\d{1,13}(\.\d{1,4})?$/, 'Enter a non-negative amount with up to four decimals.');

const adjustmentSchema = z
  .string()
  .trim()
  .regex(/^-?\d{1,4}(\.\d{1,4})?$/, 'Enter a percentage with up to four decimals.')
  .refine((value) => {
    const amount = Number.parseFloat(value);
    return amount >= -100 && amount <= 1000;
  }, 'Enter a percentage between -100 and 1000.');

const bundleItemSchema = z.object({
  productId: uuidSchema,
  quantity: quantitySchema.refine(
    (value) => Number.parseFloat(value) > 0,
    'A bundle item quantity must be greater than zero.'
  ),
  sortOrder: z.number().int().min(0).default(0),
});

export const bundleSchema = z
  .object({
    bundleId: uuidSchema.optional(),
    name: shortTextSchema.max(100, 'Keep the bundle name under 100 characters.'),
    description: optionalLongTextSchema,
    currency: currencyCodeSchema,
    bundlePrice: nonNegativeMoneySchema,
    isArchived: booleanFromFormSchema.optional().default(false),
    items: z.array(bundleItemSchema).min(1, 'Add at least one product or service.').max(100),
  })
  .superRefine((value, context) => {
    const productIds = new Set<string>();

    for (const [index, item] of value.items.entries()) {
      if (productIds.has(item.productId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', index, 'productId'],
          message: 'A product or service can appear only once in a bundle.',
        });
      }
      productIds.add(item.productId);
    }
  });

export const priceListItemSchema = z
  .object({
    productId: uuidSchema,
    fixedPrice: nonNegativeMoneySchema.optional(),
    adjustmentPercentage: adjustmentSchema.optional(),
    minimumQuantity: quantitySchema.refine(
      (value) => Number.parseFloat(value) > 0,
      'A quantity break must be greater than zero.'
    ),
  })
  .refine((value) => value.fixedPrice !== undefined || value.adjustmentPercentage !== undefined, {
    path: ['fixedPrice'],
    message: 'Enter a fixed price or an adjustment percentage.',
  });

export const priceListSchema = z
  .object({
    priceListId: uuidSchema.optional(),
    name: shortTextSchema.max(100, 'Keep the price list name under 100 characters.'),
    description: optionalLongTextSchema,
    method: z.enum(['fixed_price', 'discount_percentage', 'markup_percentage']),
    adjustmentPercentage: adjustmentSchema,
    currency: currencyCodeSchema.optional().nullable(),
    effectiveFrom: optionalIsoDateSchema,
    effectiveTo: optionalIsoDateSchema,
    isDefault: booleanFromFormSchema.optional().default(false),
    items: z.array(priceListItemSchema).max(500).default([]),
  })
  .superRefine((value, context) => {
    if (
      value.effectiveFrom !== null &&
      value.effectiveTo !== null &&
      value.effectiveTo < value.effectiveFrom
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['effectiveTo'],
        message: 'The end date cannot be before the start date.',
      });
    }

    const productQuantities = new Set<string>();

    for (const [index, item] of value.items.entries()) {
      const key = `${item.productId}:${item.minimumQuantity}`;

      if (productQuantities.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', index],
          message: 'Each product and quantity break can appear only once.',
        });
      }
      productQuantities.add(key);
    }

    if (value.method === 'fixed_price') {
      value.items.forEach((item, index) => {
        if (item.fixedPrice === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items', index, 'fixedPrice'],
            message: 'A fixed-price list needs a fixed price for each override.',
          });
        }
      });
    }
  });

export type BundleInput = z.input<typeof bundleSchema>;
export type PriceListInput = z.input<typeof priceListSchema>;
export type PriceListMethod = z.infer<typeof priceListSchema>['method'];
