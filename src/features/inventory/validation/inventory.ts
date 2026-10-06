// src/features/inventory/validation/inventory.ts
// What may be said about stock.

import { z } from 'zod';

import { moneySchema, uuidSchema } from '@/lib/validation/primitives';

export const MOVEMENT_TYPES = [
  'opening_balance',
  'purchase',
  'sales_return',
  'purchase_return',
  'adjustment_increase',
  'adjustment_decrease',
  'damage',
  'write_off',
] as const;

const quantitySchema = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,3})?$/, 'Enter a quantity greater than zero.')
  .refine((value) => Number.parseFloat(value) > 0, 'Enter a quantity greater than zero.');

export const recordMovementSchema = z.object({
  productId: uuidSchema,
  warehouseId: uuidSchema.optional(),
  movementType: z.enum(MOVEMENT_TYPES),
  quantity: quantitySchema,
  unitCost: moneySchema.optional(),
  movementDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.')
    .optional(),
  notes: z.string().trim().max(300).optional(),
});

export const transferStockSchema = z
  .object({
    productId: uuidSchema,
    fromWarehouseId: uuidSchema,
    toWarehouseId: uuidSchema,
    quantity: quantitySchema,
    notes: z.string().trim().max(300).optional(),
  })
  .refine((value) => value.fromWarehouseId !== value.toWarehouseId, {
    path: ['toWarehouseId'],
    message: 'Stock cannot be moved to the place it already is.',
  });

export const saveWarehouseSchema = z.object({
  warehouseId: uuidSchema.optional(),
  name: z.string().trim().min(2, 'Name the place.').max(80),
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9-]{2,12}$/, 'A short code in capitals, such as MAIN or DHK-1.')
    .optional(),
  isDefault: z.boolean().default(false),
});
