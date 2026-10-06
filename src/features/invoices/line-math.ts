// src/features/invoices/line-math.ts
// Working out what a line and a document come to while they are being typed.
// The database remains the authority once the invoice is saved; this is the
// same arithmetic, so the figure on screen matches the one that is stored.

import { addMoney, multiplyMoney, percentageOf, subtractMoney, toStoredAmount } from '@/lib/money';

export interface LineAmountsInput {
  quantity: string;
  unitPrice: string;
  discountValue: string;
  taxPercentage: string;
}

export interface LineAmounts {
  subtotal: string;
  discount: string;
  taxable: string;
  tax: string;
  total: string;
}

/**
 * Reads a figure typed into the builder, treating anything unusable as zero.
 *
 * @param value Text from the form.
 * @param fallback Value used when the text cannot be read.
 * @returns A number safe to calculate with.
 */
function toNumberText(value: string, fallback = '0'): string {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? value : fallback;
}

/**
 * Works out every amount of one line.
 *
 * @param line The line as it is currently typed.
 * @returns The subtotal, discount, tax and total of the line.
 */
export function lineAmountsOf(line: LineAmountsInput): LineAmounts {
  const quantity = toNumberText(line.quantity, '0');
  const unitPrice = toNumberText(line.unitPrice, '0');
  const discount = toNumberText(line.discountValue, '0');
  const taxPercentage = toNumberText(line.taxPercentage, '0');

  const subtotal = multiplyMoney(quantity, unitPrice);
  const cappedDiscount =
    Number.parseFloat(discount) > Number.parseFloat(toStoredAmount(subtotal))
      ? toStoredAmount(subtotal)
      : discount;
  const taxable = subtractMoney(subtotal, cappedDiscount);
  const tax = percentageOf(taxable, taxPercentage);
  const total = addMoney(taxable, tax);

  return {
    subtotal: toStoredAmount(subtotal),
    discount: toStoredAmount(cappedDiscount),
    taxable: toStoredAmount(taxable),
    tax: toStoredAmount(tax),
    total: toStoredAmount(total),
  };
}

/**
 * Works out what one line comes to.
 *
 * @param line The line as it is currently typed.
 * @returns The line total, including its tax.
 */
export function lineTotalOf(line: LineAmountsInput): string {
  return lineAmountsOf(line).total;
}

export interface DocumentAmounts {
  subtotal: string;
  discount: string;
  tax: string;
  shipping: string;
  total: string;
}

/**
 * Works out what a whole document comes to.
 *
 * @param lines The lines as they are currently typed.
 * @param shippingAmount Delivery charge added after the lines.
 * @returns The document totals.
 */
export function documentAmountsOf(
  lines: readonly LineAmountsInput[],
  shippingAmount: string
): DocumentAmounts {
  let subtotal = '0';
  let discount = '0';
  let tax = '0';

  for (const line of lines) {
    const amounts = lineAmountsOf(line);
    subtotal = toStoredAmount(addMoney(subtotal, amounts.subtotal));
    discount = toStoredAmount(addMoney(discount, amounts.discount));
    tax = toStoredAmount(addMoney(tax, amounts.tax));
  }

  const shipping = toStoredAmount(toNumberText(shippingAmount, '0'));
  const total = toStoredAmount(addMoney(subtractMoney(subtotal, discount), tax, shipping));

  return { subtotal, discount, tax, shipping, total };
}
