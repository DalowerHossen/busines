import { invalidMorRequest, invalidMorState, insufficientBalance } from './errors';
import { addSignedAmounts, compareAmounts, normalizeAmount, normalizeSignedAmount } from './money';
import type {
  PaymentHoldRecord,
  WalletBalance,
  WalletDelta,
  WalletTransactionType,
  WalletTransition,
} from './types';

export interface WalletLedgerStore {
  findByIdempotency(input: {
    readonly walletAccountId: string;
    readonly idempotencyKey: string;
  }): Promise<WalletTransition | null>;
  append(input: WalletTransition): Promise<WalletTransition>;
}

export function createWalletTransition(input: {
  readonly transactionType: WalletTransactionType;
  readonly idempotencyKey?: string;
  readonly currencyCode: string;
  readonly before: WalletBalance;
  readonly delta: WalletDelta;
  readonly referenceType?: string;
  readonly referenceId?: string;
}): WalletTransition {
  if (!/^[A-Z]{3}$/u.test(input.currencyCode) || input.before.version < 0) {
    throw invalidMorRequest();
  }
  const before = normalizeBalance(input.before);
  const delta = normalizeDelta(input.delta);
  const after = {
    available: addSignedAmounts(before.available, delta.available),
    held: addSignedAmounts(before.held, delta.held),
    pending: addSignedAmounts(before.pending, delta.pending),
    version: before.version + 1,
  };
  if (
    compareAmounts(after.available, '0') < 0 ||
    compareAmounts(after.held, '0') < 0 ||
    compareAmounts(after.pending, '0') < 0
  ) {
    throw insufficientBalance();
  }
  return {
    transactionType: input.transactionType,
    idempotencyKey: input.idempotencyKey ?? null,
    currencyCode: input.currencyCode,
    before,
    delta,
    after,
    totalAmount: addSignedAmounts(delta.available, delta.held, delta.pending),
    referenceType: input.referenceType ?? null,
    referenceId: input.referenceId ?? null,
  };
}

export async function postWalletTransition(
  store: WalletLedgerStore,
  input: {
    readonly walletAccountId: string;
    readonly transition: Parameters<typeof createWalletTransition>[0];
  }
): Promise<{ readonly transition: WalletTransition; readonly duplicate: boolean }> {
  const idempotencyKey = input.transition.idempotencyKey;
  if (idempotencyKey) {
    const existing = await store.findByIdempotency({
      walletAccountId: input.walletAccountId,
      idempotencyKey,
    });
    if (existing) return { transition: existing, duplicate: true };
  }
  const transition = createWalletTransition(input.transition);
  return { transition: await store.append(transition), duplicate: false };
}

export function createPaymentHoldTransition(input: {
  readonly before: WalletBalance;
  readonly currencyCode: string;
  readonly amount: string;
  readonly paymentId: string;
  readonly idempotencyKey: string;
}): WalletTransition {
  const amount = normalizeAmount(input.amount);
  return createWalletTransition({
    transactionType: 'hold_created',
    idempotencyKey: input.idempotencyKey,
    currencyCode: input.currencyCode,
    before: input.before,
    delta: { available: `-${amount}`, held: amount, pending: '0' },
    referenceType: 'payment',
    referenceId: input.paymentId,
  });
}

export function createHoldReleaseTransition(input: {
  readonly before: WalletBalance;
  readonly currencyCode: string;
  readonly amount: string;
  readonly paymentHoldId: string;
  readonly idempotencyKey: string;
}): WalletTransition {
  const amount = normalizeAmount(input.amount);
  return createWalletTransition({
    transactionType: 'hold_released',
    idempotencyKey: input.idempotencyKey,
    currencyCode: input.currencyCode,
    before: input.before,
    delta: { available: amount, held: `-${amount}`, pending: '0' },
    referenceType: 'payment_hold',
    referenceId: input.paymentHoldId,
  });
}

export function validateHoldRelease(input: {
  readonly hold: PaymentHoldRecord;
  readonly amount: string;
  readonly now: string;
}): string {
  if (input.hold.status === 'cancelled' || input.hold.status === 'released')
    throw invalidMorState();
  const nowMs = Date.parse(input.now);
  const holdUntilMs = Date.parse(input.hold.holdUntil);
  if (!Number.isFinite(nowMs) || !Number.isFinite(holdUntilMs) || nowMs < holdUntilMs) {
    throw invalidMorState();
  }
  const amount = normalizeAmount(input.amount);
  const remaining = addSignedAmounts(input.hold.amount, `-${input.hold.releasedAmount}`);
  if (compareAmounts(amount, remaining) > 0) throw invalidMorRequest();
  return amount;
}

function normalizeBalance(balance: WalletBalance): WalletBalance {
  return {
    available: normalizeAmount(balance.available, { allowZero: true }),
    held: normalizeAmount(balance.held, { allowZero: true }),
    pending: normalizeAmount(balance.pending, { allowZero: true }),
    version: balance.version,
  };
}

function normalizeDelta(delta: WalletDelta): WalletDelta {
  return {
    available: normalizeSignedAmount(delta.available),
    held: normalizeSignedAmount(delta.held),
    pending: normalizeSignedAmount(delta.pending),
  };
}
