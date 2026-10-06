import { duplicateReceipt, invalidAccountingRequest, ocrUnavailable } from './errors';
import { compareAccountingAmounts, normalizeAccountingAmount } from './money';
import { isValidCalendarDate } from './journal';
import type {
  ReceiptOcrAdapter,
  ReceiptOcrRequest,
  ReceiptOcrResult,
  ReceiptOcrStore,
} from './types';

export const MAX_RECEIPT_OCR_BYTES = 10_485_760;

export async function extractReceiptFields(input: {
  readonly request: ReceiptOcrRequest;
  readonly adapter: ReceiptOcrAdapter;
  readonly store: ReceiptOcrStore;
  readonly maxSizeBytes?: number;
}): Promise<{ readonly result: ReceiptOcrResult; readonly duplicate: boolean }> {
  validateReceiptOcrRequest(input.request, input.maxSizeBytes ?? MAX_RECEIPT_OCR_BYTES);
  const existing = await input.store.findByContentHash({
    companyId: input.request.companyId,
    contentSha256: input.request.contentSha256,
  });
  if (existing) return { result: existing, duplicate: true };
  let extracted: ReceiptOcrResult;
  try {
    extracted = await input.adapter.extract(input.request);
  } catch (error) {
    if (error instanceof Error && error.name === 'AccountingError') throw error;
    throw ocrUnavailable(true);
  }
  const result = normalizeReceiptOcrResult(extracted, input.adapter.providerId);
  try {
    return {
      result: await input.store.create({ request: input.request, result }),
      duplicate: false,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AccountingError') throw error;
    throw duplicateReceipt();
  }
}

export function validateReceiptOcrRequest(input: ReceiptOcrRequest, maxSizeBytes: number): void {
  if (
    !input.companyId.trim() ||
    !input.providerFileId.trim() ||
    !input.requestedByUserId.trim() ||
    !/^[a-f0-9]{64}$/iu.test(input.contentSha256) ||
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes < 1 ||
    input.sizeBytes > maxSizeBytes ||
    !Number.isSafeInteger(maxSizeBytes) ||
    maxSizeBytes < 1
  ) {
    throw invalidAccountingRequest();
  }
}

export function normalizeReceiptOcrResult(
  input: ReceiptOcrResult,
  expectedProviderId: string
): ReceiptOcrResult {
  if (
    !expectedProviderId.trim() ||
    input.providerId !== expectedProviderId ||
    !input.providerRequestId.trim() ||
    !/^[A-Z]{3}$/u.test(input.currencyCode ?? 'USD')
  ) {
    throw invalidAccountingRequest();
  }
  const confidence = normalizeAccountingAmount(input.confidence, { allowZero: true });
  if (compareAccountingAmounts(confidence, '1') > 0) throw invalidAccountingRequest();
  if (input.receiptDate !== null && !isValidCalendarDate(input.receiptDate)) {
    throw invalidAccountingRequest();
  }
  const normalizedLineItems = input.lineItems.map((lineItem) => ({
    description: lineItem.description.trim(),
    quantity: normalizeOptionalAmount(lineItem.quantity, true),
    unitPrice: normalizeOptionalAmount(lineItem.unitPrice, false),
    total: normalizeOptionalAmount(lineItem.total, false),
  }));
  if (normalizedLineItems.some((lineItem) => !lineItem.description)) {
    throw invalidAccountingRequest();
  }
  return {
    ...input,
    providerId: input.providerId.trim(),
    providerRequestId: input.providerRequestId.trim(),
    vendorName: input.vendorName?.trim() || null,
    currencyCode: input.currencyCode,
    subtotalAmount: normalizeOptionalAmount(input.subtotalAmount, false),
    taxAmount: normalizeOptionalAmount(input.taxAmount, false),
    totalAmount: normalizeOptionalAmount(input.totalAmount, false),
    confidence,
    lineItems: normalizedLineItems,
  };
}

function normalizeOptionalAmount(value: string | null, allowZero: boolean): string | null {
  return value === null
    ? null
    : normalizeAccountingAmount(value, { allowZero, allowNegative: false });
}
