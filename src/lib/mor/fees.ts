import { invalidMorRequest } from './errors';
import {
  addAmounts,
  compareAmounts,
  maximumAmount,
  multiplyPercentage,
  normalizeAmount,
  subtractAmounts,
} from './money';
import type { CardFeeTier, FeeCalculation, FeeRule } from './types';

export const DEFAULT_CARD_FEE_RULES: readonly FeeRule[] = [
  {
    id: 'default-domestic-us-standard-card-fee',
    companyId: null,
    ruleName: 'Domestic US Standard card fee',
    cardFeeTier: 'domestic_us_standard',
    percentageRate: '2.7',
    minimumFeeAmount: '0',
    fixedFeeAmount: '0.25',
    currencyCode: 'USD',
    holdPeriodDays: 7,
    payoutSlaHours: 24,
    minimumPayoutAmount: '0',
    isActive: true,
    effectiveFrom: '2026-01-01T00:00:00Z',
    effectiveUntil: null,
  },
  {
    id: 'default-premium-international-corporate-card-fee',
    companyId: null,
    ruleName: 'Premium International Corporate card fee',
    cardFeeTier: 'premium_international_corporate',
    percentageRate: '3.7',
    minimumFeeAmount: '0',
    fixedFeeAmount: '0.25',
    currencyCode: 'USD',
    holdPeriodDays: 7,
    payoutSlaHours: 24,
    minimumPayoutAmount: '0',
    isActive: true,
    effectiveFrom: '2026-01-01T00:00:00Z',
    effectiveUntil: null,
  },
];

export function resolveFeeRule(input: {
  readonly companyRules: readonly FeeRule[];
  readonly platformRules: readonly FeeRule[];
  readonly companyId: string;
  readonly at: string;
  readonly feeTier?: CardFeeTier;
}): FeeRule {
  const atMs = Date.parse(input.at);
  if (!Number.isFinite(atMs) || !input.companyId.trim()) throw invalidMorRequest();
  const feeTier = input.feeTier ?? 'domestic_us_standard';
  const companyRule = selectEffectiveRule(
    input.companyRules.filter((rule) => rule.companyId === input.companyId),
    atMs,
    feeTier
  );
  if (companyRule) return companyRule;
  const platformRule = selectEffectiveRule(
    input.platformRules.filter((rule) => rule.companyId === null),
    atMs,
    feeTier
  );
  if (platformRule) return platformRule;
  const defaultRule = DEFAULT_CARD_FEE_RULES.find((rule) => rule.cardFeeTier === feeTier);
  if (!defaultRule) throw invalidMorRequest();
  return defaultRule;
}

export function calculatePlatformFee(input: {
  readonly paymentAmount: string;
  readonly currencyCode: string;
  readonly rule: FeeRule;
  readonly cardFeeTier?: CardFeeTier;
}): FeeCalculation {
  const cardFeeTier = input.cardFeeTier ?? input.rule.cardFeeTier;
  if (input.currencyCode !== input.rule.currencyCode || input.rule.cardFeeTier !== cardFeeTier) {
    throw invalidMorRequest();
  }
  validateFeeRule(input.rule);
  const paymentAmount = normalizeAmount(input.paymentAmount);
  const percentageFeeAmount = multiplyPercentage(paymentAmount, input.rule.percentageRate);
  const minimumFeeAmount = normalizeAmount(input.rule.minimumFeeAmount, { allowZero: true });
  const fixedFeeAmount = normalizeAmount(input.rule.fixedFeeAmount, { allowZero: true });
  const chargedFeeAmount = addAmounts(
    maximumAmount(percentageFeeAmount, minimumFeeAmount),
    fixedFeeAmount
  );
  return {
    ruleId: input.rule.id,
    cardFeeTier,
    currencyCode: input.currencyCode,
    paymentAmount,
    percentageRate: normalizeAmount(input.rule.percentageRate, { allowZero: true }),
    percentageFeeAmount,
    minimumFeeAmount,
    fixedFeeAmount,
    chargedFeeAmount,
  };
}

export function calculateNetPayout(input: {
  readonly requestedAmount: string;
  readonly feeAmount: string;
  readonly availableBalance: string;
}): {
  readonly requestedAmount: string;
  readonly feeAmount: string;
  readonly netPayoutAmount: string;
} {
  const requestedAmount = normalizeAmount(input.requestedAmount);
  const feeAmount = normalizeAmount(input.feeAmount, { allowZero: true });
  const availableBalance = normalizeAmount(input.availableBalance, { allowZero: true });
  if (
    compareAmounts(requestedAmount, availableBalance) > 0 ||
    compareAmounts(feeAmount, requestedAmount) > 0
  ) {
    throw invalidMorRequest();
  }
  return {
    requestedAmount,
    feeAmount,
    netPayoutAmount: subtractAmounts(requestedAmount, feeAmount),
  };
}

function selectEffectiveRule(
  rules: readonly FeeRule[],
  atMs: number,
  feeTier: CardFeeTier
): FeeRule | null {
  return (
    rules
      .filter((rule) => rule.isActive && rule.cardFeeTier === feeTier)
      .filter((rule) => {
        const effectiveFrom = Date.parse(rule.effectiveFrom);
        const effectiveUntil = rule.effectiveUntil
          ? Date.parse(rule.effectiveUntil)
          : Number.POSITIVE_INFINITY;
        return Number.isFinite(effectiveFrom) && effectiveFrom <= atMs && effectiveUntil > atMs;
      })
      .sort((left, right) => Date.parse(right.effectiveFrom) - Date.parse(left.effectiveFrom))[0] ??
    null
  );
}

function validateFeeRule(rule: FeeRule): void {
  const rate = Number(rule.percentageRate);
  if (
    !rule.id ||
    !rule.ruleName ||
    !rule.cardFeeTier ||
    !/^[A-Z]{3}$/u.test(rule.currencyCode) ||
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > 100 ||
    rule.holdPeriodDays < 0 ||
    rule.holdPeriodDays > 365 ||
    rule.payoutSlaHours < 1
  ) {
    throw invalidMorRequest();
  }
  normalizeAmount(rule.minimumFeeAmount, { allowZero: true });
  normalizeAmount(rule.fixedFeeAmount, { allowZero: true });
  normalizeAmount(rule.minimumPayoutAmount, { allowZero: true });
}
