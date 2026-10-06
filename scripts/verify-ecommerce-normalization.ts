import assert from 'node:assert/strict';
import { normalizeShopifyOrder, normalizeWooCommerceOrder } from '@/lib/ecommerce/normalize';
import type { ShopifyAdminOrder } from '@/lib/ecommerce/shopify-admin';
import type { WooCommerceOrder } from '@/lib/ecommerce/woocommerce';

const money = (amount: string, currencyCode = 'USD') => ({
  shopMoney: { amount, currencyCode },
});

const shopifyOrder: ShopifyAdminOrder = {
  id: 'gid://shopify/Order/1001',
  name: '#1001',
  email: 'buyer@example.com',
  phone: '+1 555 0100',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:01Z',
  currencyCode: 'USD',
  displayFinancialStatus: 'PAID',
  displayFulfillmentStatus: null,
  currentSubtotalPriceSet: money('10.00'),
  currentTotalDiscountsSet: money('0.30'),
  currentShippingPriceSet: money('2.00'),
  currentTotalTaxSet: money('1.25'),
  currentTotalPriceSet: money('12.95'),
  customer: { displayName: 'Buyer', email: 'buyer@example.com', phone: '+1 555 0100' },
  billingAddress: null,
  shippingAddress: null,
  lineItems: {
    nodes: [
      {
        id: 'gid://shopify/LineItem/2001',
        name: 'Sample item',
        quantity: 2,
        sku: 'SKU-1',
        product: { id: 'gid://shopify/Product/3001' },
        variant: { id: 'gid://shopify/ProductVariant/4001' },
        originalUnitPriceSet: money('5.15'),
        discountedTotalSet: money('10.00'),
        totalDiscountSet: money('0.30'),
        taxLines: [{ priceSet: money('0.75') }, { priceSet: money('0.50') }],
      },
    ],
  },
};

const wooCommerceOrder: WooCommerceOrder = {
  id: 5001,
  number: '5001',
  status: 'processing',
  currency: 'USD',
  date_created: '2026-10-01T00:00:00',
  date_modified: '2026-10-01T00:00:01',
  total: '12.95',
  subtotal: '10.00',
  total_tax: '1.25',
  total_shipping: '2.00',
  total_discount: '0.30',
  billing: {
    first_name: 'Buyer',
    last_name: '',
    company: '',
    address_1: '',
    address_2: '',
    city: '',
    state: '',
    postcode: '',
    country: 'US',
    email: 'buyer@example.com',
    phone: '',
  },
  shipping: {
    first_name: '',
    last_name: '',
    company: '',
    address_1: '',
    address_2: '',
    city: '',
    state: '',
    postcode: '',
    country: '',
    email: '',
    phone: '',
  },
  line_items: [
    {
      id: 6001,
      name: 'Sample item',
      product_id: 7001,
      variation_id: 8001,
      quantity: 2,
      tax_class: '',
      subtotal: '10.30',
      subtotal_tax: '1.25',
      total: '10.00',
      total_tax: '1.25',
      sku: 'SKU-1',
      price: '5.00',
    },
  ],
};

const normalizedShopify = normalizeShopifyOrder(shopifyOrder);
const normalizedWooCommerce = normalizeWooCommerceOrder(wooCommerceOrder);

assert.equal(normalizedShopify.status, 'paid');
assert.equal(normalizedShopify.lineItems[0]?.taxAmount, '1.25');
assert.equal(normalizedShopify.lineItems[0]?.lineTotalAmount, '10.00');
assert.equal(normalizedWooCommerce.status, 'paid');
assert.equal(normalizedWooCommerce.lineItems[0]?.discountAmount, '0.3');
assert.equal(normalizedWooCommerce.totalAmount, '12.95');

process.stdout.write('Ecommerce order normalization smoke test passed.\n');
