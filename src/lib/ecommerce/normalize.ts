import Decimal from 'decimal.js';
import { invalidResponse } from './errors';
import type { ShopifyAdminLineItem, ShopifyAdminOrder } from './shopify-admin';
import type { WooCommerceOrder } from './woocommerce';
import type { EcommerceAddress, EcommerceOrderLineItem, NormalizedEcommerceOrder } from './types';

export function normalizeShopifyOrder(order: ShopifyAdminOrder): NormalizedEcommerceOrder {
  const lines = order.lineItems.nodes.map((lineItem) => normalizeShopifyLineItem(lineItem));
  return {
    platform: 'shopify',
    externalOrderId: order.id,
    externalOrderNumber: order.name || null,
    status: normalizeShopifyStatus(order.displayFinancialStatus, order.displayFulfillmentStatus),
    externalFinancialStatus: order.displayFinancialStatus,
    externalFulfillmentStatus: order.displayFulfillmentStatus,
    customerName: order.customer?.displayName ?? null,
    customerEmail: order.email ?? order.customer?.email ?? null,
    customerPhone: order.phone ?? order.customer?.phone ?? null,
    billingAddress: normalizeShopifyAddress(order.billingAddress),
    shippingAddress: normalizeShopifyAddress(order.shippingAddress),
    currencyCode: order.currentTotalPriceSet.shopMoney.currencyCode || order.currencyCode,
    subtotalAmount: order.currentSubtotalPriceSet.shopMoney.amount,
    discountAmount: order.currentTotalDiscountsSet.shopMoney.amount,
    shippingAmount: order.currentShippingPriceSet.shopMoney.amount,
    taxAmount: order.currentTotalTaxSet.shopMoney.amount,
    totalAmount: order.currentTotalPriceSet.shopMoney.amount,
    externalCreatedAt: order.createdAt || null,
    externalUpdatedAt: order.updatedAt || null,
    lineItems: lines,
    rawPayload: order as unknown as Readonly<Record<string, unknown>>,
  };
}

export function normalizeWooCommerceOrder(order: WooCommerceOrder): NormalizedEcommerceOrder {
  const lines = order.line_items.map((lineItem) => normalizeWooCommerceLineItem(lineItem));
  const customerName = [order.billing.first_name, order.billing.last_name]
    .filter((part) => part.length > 0)
    .join(' ');
  return {
    platform: 'woocommerce',
    externalOrderId: String(order.id),
    externalOrderNumber: order.number || null,
    status: normalizeWooCommerceStatus(order.status),
    externalFinancialStatus: statusToFinancialStatus(order.status),
    externalFulfillmentStatus: statusToFulfillmentStatus(order.status),
    customerName: customerName || null,
    customerEmail: order.billing.email || null,
    customerPhone: order.billing.phone || null,
    billingAddress: normalizeWooCommerceAddress(order.billing),
    shippingAddress: normalizeWooCommerceAddress(order.shipping),
    currencyCode: order.currency,
    subtotalAmount: order.subtotal,
    discountAmount: order.total_discount,
    shippingAmount: order.total_shipping,
    taxAmount: order.total_tax,
    totalAmount: order.total,
    externalCreatedAt: order.date_created || null,
    externalUpdatedAt: order.date_modified || null,
    lineItems: lines,
    rawPayload: order as unknown as Readonly<Record<string, unknown>>,
  };
}

function normalizeShopifyLineItem(lineItem: ShopifyAdminLineItem): EcommerceOrderLineItem {
  return {
    externalLineId: lineItem.id,
    externalProductId: lineItem.product?.id ?? null,
    externalVariantId: lineItem.variant?.id ?? null,
    sku: lineItem.sku,
    description: lineItem.name,
    quantity: String(lineItem.quantity),
    unitPriceAmount: lineItem.originalUnitPriceSet.shopMoney.amount,
    discountAmount: lineItem.totalDiscountSet.shopMoney.amount,
    taxAmount: sumAmounts(lineItem.taxLines.map((taxLine) => taxLine.priceSet.shopMoney.amount)),
    lineTotalAmount: lineItem.discountedTotalSet.shopMoney.amount,
  };
}

function normalizeWooCommerceLineItem(
  lineItem: WooCommerceOrder['line_items'][number]
): EcommerceOrderLineItem {
  return {
    externalLineId: String(lineItem.id),
    externalProductId: lineItem.product_id > 0 ? String(lineItem.product_id) : null,
    externalVariantId: lineItem.variation_id > 0 ? String(lineItem.variation_id) : null,
    sku: lineItem.sku,
    description: lineItem.name,
    quantity: String(lineItem.quantity),
    unitPriceAmount: lineItem.price,
    discountAmount: subtractAmounts(lineItem.subtotal, lineItem.total),
    taxAmount: lineItem.total_tax,
    lineTotalAmount: lineItem.total,
  };
}

function normalizeShopifyAddress(
  address: ShopifyAdminOrder['billingAddress']
): EcommerceAddress | null {
  if (!address) return null;
  return {
    firstName: address.firstName ?? undefined,
    lastName: address.lastName ?? undefined,
    company: address.company ?? undefined,
    address1: address.address1 ?? undefined,
    address2: address.address2 ?? undefined,
    city: address.city ?? undefined,
    state: address.province ?? undefined,
    postalCode: address.zip ?? undefined,
    countryCode: address.countryCode ?? undefined,
    phone: address.phone ?? undefined,
  };
}

function normalizeWooCommerceAddress(
  address: WooCommerceOrder['billing']
): EcommerceAddress | null {
  const hasAddress = Object.values(address).some((value) => value.length > 0);
  if (!hasAddress) return null;
  return {
    firstName: address.first_name || undefined,
    lastName: address.last_name || undefined,
    company: address.company || undefined,
    address1: address.address_1 || undefined,
    address2: address.address_2 || undefined,
    city: address.city || undefined,
    state: address.state || undefined,
    postalCode: address.postcode || undefined,
    countryCode: address.country || undefined,
    email: address.email || undefined,
    phone: address.phone || undefined,
  };
}

function normalizeShopifyStatus(
  financialStatus: string | null,
  fulfillmentStatus: string | null
): NormalizedEcommerceOrder['status'] {
  if (financialStatus === 'REFUNDED') return 'refunded';
  if (financialStatus === 'VOIDED' || financialStatus === 'CANCELLED') return 'cancelled';
  if (fulfillmentStatus === 'FULFILLED') return 'fulfilled';
  if (financialStatus === 'PAID' || financialStatus === 'PARTIALLY_PAID') return 'paid';
  return 'pending';
}

function normalizeWooCommerceStatus(status: string): NormalizedEcommerceOrder['status'] {
  switch (status) {
    case 'completed':
      return 'fulfilled';
    case 'processing':
      return 'paid';
    case 'refunded':
      return 'refunded';
    case 'cancelled':
      return 'cancelled';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}

function statusToFinancialStatus(status: string): string | null {
  switch (status) {
    case 'processing':
    case 'completed':
      return 'paid';
    case 'refunded':
      return 'refunded';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}

function statusToFulfillmentStatus(status: string): string | null {
  return status === 'completed' ? 'fulfilled' : null;
}

function sumAmounts(values: readonly string[]): string {
  try {
    return values
      .reduce((total, value) => total.plus(new Decimal(value)), new Decimal(0))
      .toFixed();
  } catch {
    throw invalidResponse('shopify');
  }
}

function subtractAmounts(left: string, right: string): string {
  try {
    const result = new Decimal(left).minus(new Decimal(right));
    return result.isNegative() ? '0' : result.toFixed();
  } catch {
    throw invalidResponse('woocommerce');
  }
}
