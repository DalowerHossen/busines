// tests/unit/product-catalogue.test.ts
// Bundle and price-list rules are pure domain validation, so they are tested
// without a database or a browser.

import { describe, expect, it } from 'vitest';

import { bundleSchema, priceListSchema } from '@/features/products/validation/catalogue';

const PRODUCT_A = '00000000-0000-4000-8000-000000000001';
const PRODUCT_B = '00000000-0000-4000-8000-000000000002';

const bundleInput = {
  name: 'Starter kit',
  description: '',
  currency: 'USD',
  bundlePrice: '49.9900',
  items: [{ productId: PRODUCT_A, quantity: '2', sortOrder: 0 }],
};

const priceListInput = {
  name: 'Wholesale',
  description: '',
  method: 'discount_percentage' as const,
  adjustmentPercentage: '-10',
  currency: 'USD',
  effectiveFrom: '2026-10-01',
  effectiveTo: '2026-12-31',
  items: [
    {
      productId: PRODUCT_A,
      adjustmentPercentage: '-15',
      minimumQuantity: '10.000',
    },
  ],
};

describe('catalogue bundle validation', () => {
  it('accepts a bundle and defaults its archive flag', () => {
    const result = bundleSchema.safeParse(bundleInput);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isArchived).toBe(false);
  });

  it('rejects duplicate bundle components', () => {
    const result = bundleSchema.safeParse({
      ...bundleInput,
      items: [...bundleInput.items, { productId: PRODUCT_A, quantity: '1', sortOrder: 1 }],
    });

    expect(result.success).toBe(false);
  });
});

describe('price-list validation', () => {
  it('accepts quantity breaks and an effective period', () => {
    const result = priceListSchema.safeParse(priceListInput);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.items).toHaveLength(1);
  });

  it('rejects an inverted effective period', () => {
    const result = priceListSchema.safeParse({
      ...priceListInput,
      effectiveFrom: '2026-12-31',
      effectiveTo: '2026-10-01',
    });

    expect(result.success).toBe(false);
  });

  it('requires fixed prices for fixed-price lists', () => {
    const result = priceListSchema.safeParse({
      ...priceListInput,
      method: 'fixed_price',
    });

    expect(result.success).toBe(false);
  });

  it('accepts a fixed-price override', () => {
    const result = priceListSchema.safeParse({
      ...priceListInput,
      method: 'fixed_price',
      items: [
        {
          productId: PRODUCT_B,
          fixedPrice: '24.5000',
          minimumQuantity: '1',
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
