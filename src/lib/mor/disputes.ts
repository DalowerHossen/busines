import Decimal from 'decimal.js';
import { invalidMorRequest } from './errors';
import { compareAmounts, multiplyPercentage, normalizeAmount, subtractAmounts } from './money';
import type {
  ChargebackReserveCalculation,
  ChargebackStatus,
  DisputeRateCalculation,
  EvidenceRetentionDecision,
} from './types';

export function calculateChargebackReserve(input: {
  readonly currencyCode: string;
  readonly chargebackAmount: string;
  readonly reservePercentage: string;
  readonly existingReserveAmount: string;
}): ChargebackReserveCalculation {
  if (!/^[A-Z]{3}$/u.test(input.currencyCode)) throw invalidMorRequest();
  const chargebackAmount = normalizeAmount(input.chargebackAmount);
  const reservePercentage = normalizeAmount(input.reservePercentage, { allowZero: true });
  const existingReserveAmount = normalizeAmount(input.existingReserveAmount, { allowZero: true });
  if (compareAmounts(reservePercentage, '100') > 0) throw invalidMorRequest();

  const targetReserveAmount = multiplyPercentage(chargebackAmount, reservePercentage);
  const additionalReserveAmount =
    compareAmounts(targetReserveAmount, existingReserveAmount) > 0
      ? subtractAmounts(targetReserveAmount, existingReserveAmount)
      : '0.0000';
  const releasableReserveAmount =
    compareAmounts(existingReserveAmount, targetReserveAmount) > 0
      ? subtractAmounts(existingReserveAmount, targetReserveAmount)
      : '0.0000';
  return {
    currencyCode: input.currencyCode,
    chargebackAmount,
    reservePercentage,
    targetReserveAmount,
    existingReserveAmount,
    additionalReserveAmount,
    releasableReserveAmount,
  };
}

export function calculateDisputeRate(input: {
  readonly chargebackCount: number;
  readonly eligiblePaymentCount: number;
  readonly alertThresholdPercentage: string;
}): DisputeRateCalculation {
  if (
    !Number.isSafeInteger(input.chargebackCount) ||
    !Number.isSafeInteger(input.eligiblePaymentCount) ||
    input.chargebackCount < 0 ||
    input.eligiblePaymentCount < 0 ||
    input.chargebackCount > input.eligiblePaymentCount
  ) {
    throw invalidMorRequest();
  }
  const alertThresholdPercentage = normalizeAmount(input.alertThresholdPercentage, {
    allowZero: true,
  });
  if (compareAmounts(alertThresholdPercentage, '100') > 0) throw invalidMorRequest();
  const disputeRatePercentage = new Decimal(
    input.eligiblePaymentCount === 0 ? 0 : input.chargebackCount
  )
    .dividedBy(input.eligiblePaymentCount === 0 ? 1 : input.eligiblePaymentCount)
    .times(100)
    .toFixed(4);
  return {
    chargebackCount: input.chargebackCount,
    eligiblePaymentCount: input.eligiblePaymentCount,
    disputeRatePercentage,
    alertThresholdPercentage,
    thresholdExceeded: compareAmounts(disputeRatePercentage, alertThresholdPercentage) > 0,
  };
}

export function decideEvidenceRetention(input: {
  readonly createdAt: string;
  readonly now: string;
  readonly retentionMonths: number;
  readonly retentionPolicyVersion: string;
  readonly disputeStatus: ChargebackStatus;
  readonly legalHold: boolean;
}): EvidenceRetentionDecision {
  const createdAtMs = Date.parse(input.createdAt);
  const nowMs = Date.parse(input.now);
  if (
    !Number.isFinite(createdAtMs) ||
    !Number.isFinite(nowMs) ||
    !Number.isSafeInteger(input.retentionMonths) ||
    input.retentionMonths < 1 ||
    input.retentionMonths > 120 ||
    !input.retentionPolicyVersion.trim()
  ) {
    throw invalidMorRequest();
  }
  const retentionUntilDate = new Date(createdAtMs);
  retentionUntilDate.setUTCMonth(retentionUntilDate.getUTCMonth() + input.retentionMonths);
  const retentionUntil = retentionUntilDate.toISOString();
  const withinRetentionWindow = nowMs < retentionUntilDate.getTime();
  let reason: EvidenceRetentionDecision['reason'];
  if (input.legalHold) reason = 'legal_hold';
  else if (input.disputeStatus === 'open' || input.disputeStatus === 'evidence_submitted') {
    reason = 'active_dispute';
  } else if (withinRetentionWindow) reason = 'within_retention_window';
  else reason = 'window_expired';
  return {
    action: reason === 'window_expired' ? 'eligible_for_deletion' : 'retain',
    retentionPolicyVersion: input.retentionPolicyVersion.trim(),
    retentionUntil,
    reason,
  };
}
