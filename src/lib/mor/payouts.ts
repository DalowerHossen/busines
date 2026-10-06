import { invalidMorRequest, invalidMorState, insufficientBalance } from './errors';
import { calculatePlatformFee, calculateNetPayout } from './fees';
import { compareAmounts, normalizeAmount } from './money';
import type { PayoutRequestDecision, PayoutRequestInput, PayoutStatus } from './types';

export interface PayoutDestinationSnapshot {
  readonly id: string;
  readonly status: 'pending' | 'verified' | 'disabled';
  readonly currencyCode: string;
}

export interface PayoutRequestStore {
  findByIdempotency(input: {
    readonly companyId: string;
    readonly idempotencyKey: string;
  }): Promise<PayoutRequestDecision | null>;
  create(input: PayoutRequestDecision): Promise<PayoutRequestDecision>;
}

export interface PayoutRail {
  createPayout(input: {
    readonly amount: string;
    readonly currencyCode: string;
    readonly destinationId: string;
    readonly idempotencyKey: string;
  }): Promise<{ readonly providerPayoutId: string; readonly status: PayoutStatus }>;
}

export interface PayoutExecutionStore {
  markProcessing(input: { readonly idempotencyKey: string }): Promise<void>;
  markPaid(input: {
    readonly idempotencyKey: string;
    readonly providerPayoutId: string;
  }): Promise<void>;
  markFailed(input: {
    readonly idempotencyKey: string;
    readonly retryable: boolean;
  }): Promise<void>;
}

export async function requestPayout(input: {
  readonly request: PayoutRequestInput;
  readonly destination: PayoutDestinationSnapshot;
  readonly store: PayoutRequestStore;
}): Promise<{ readonly request: PayoutRequestDecision; readonly duplicate: boolean }> {
  const request = validatePayoutRequest(input.request, input.destination);
  const existing = await input.store.findByIdempotency({
    companyId: input.request.companyId,
    idempotencyKey: input.request.idempotencyKey,
  });
  if (existing) return { request: existing, duplicate: true };
  return { request: await input.store.create(request), duplicate: false };
}

export function approvePayoutRequest(input: {
  readonly request: PayoutRequestDecision;
  readonly reviewerUserId: string;
}): PayoutRequestDecision {
  if (
    (input.request.status !== 'requested' && input.request.status !== 'under_review') ||
    !input.reviewerUserId.trim() ||
    input.reviewerUserId === input.request.requestedByUserId
  ) {
    throw invalidMorState();
  }
  return {
    ...input.request,
    status: 'approved',
    reviewedByUserId: input.reviewerUserId,
  };
}

export async function executePayout(input: {
  readonly request: PayoutRequestDecision;
  readonly destinationId: string;
  readonly rail: PayoutRail;
  readonly store: PayoutExecutionStore;
}): Promise<{ readonly providerPayoutId: string; readonly status: PayoutStatus }> {
  if (input.request.status !== 'approved') throw invalidMorState();
  await input.store.markProcessing({ idempotencyKey: input.request.idempotencyKey });
  try {
    const result = await input.rail.createPayout({
      amount: input.request.netPayoutAmount,
      currencyCode: input.request.currencyCode,
      destinationId: input.destinationId,
      idempotencyKey: input.request.idempotencyKey,
    });
    if (result.status === 'paid') {
      await input.store.markPaid({
        idempotencyKey: input.request.idempotencyKey,
        providerPayoutId: result.providerPayoutId,
      });
    } else if (
      result.status === 'failed' ||
      result.status === 'rejected' ||
      result.status === 'cancelled'
    ) {
      await input.store.markFailed({
        idempotencyKey: input.request.idempotencyKey,
        retryable: false,
      });
    }
    return result;
  } catch (error) {
    const retryable =
      typeof error === 'object' &&
      error !== null &&
      'retryable' in error &&
      (error as { readonly retryable?: unknown }).retryable === true;
    await input.store.markFailed({ idempotencyKey: input.request.idempotencyKey, retryable });
    throw error;
  }
}

function validatePayoutRequest(
  input: PayoutRequestInput,
  destination: PayoutDestinationSnapshot
): PayoutRequestDecision {
  if (
    !input.companyId ||
    !input.walletAccountId ||
    !input.payoutDestinationId ||
    !input.requestedByUserId ||
    !input.idempotencyKey ||
    destination.id !== input.payoutDestinationId ||
    destination.status !== 'verified' ||
    destination.currencyCode !== input.currencyCode ||
    input.currencyCode !== input.feeRule.currencyCode
  ) {
    throw invalidMorState();
  }
  const requestedAmount = normalizeAmount(input.requestedAmount);
  const availableBalance = normalizeAmount(input.availableBalance, { allowZero: true });
  const minimumPayoutAmount = normalizeAmount(input.feeRule.minimumPayoutAmount, {
    allowZero: true,
  });
  if (compareAmounts(requestedAmount, minimumPayoutAmount) < 0) throw invalidMorRequest();
  if (compareAmounts(requestedAmount, availableBalance) > 0) throw insufficientBalance();
  const fee = calculatePlatformFee({
    paymentAmount: requestedAmount,
    currencyCode: input.currencyCode,
    rule: input.feeRule,
  });
  const netPayout = calculateNetPayout({
    requestedAmount,
    feeAmount: fee.chargedFeeAmount,
    availableBalance,
  });
  return {
    status: 'requested',
    companyId: input.companyId,
    walletAccountId: input.walletAccountId,
    payoutDestinationId: input.payoutDestinationId,
    currencyCode: input.currencyCode,
    requestedAmount: netPayout.requestedAmount,
    platformFeeAmount: netPayout.feeAmount,
    netPayoutAmount: netPayout.netPayoutAmount,
    minimumPayoutAmount,
    requestedByUserId: input.requestedByUserId,
    reviewedByUserId: null,
    idempotencyKey: input.idempotencyKey,
  };
}
