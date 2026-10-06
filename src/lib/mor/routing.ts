import { kycRequired, morNotEligible, invalidMorRequest } from './errors';
import { compareAmounts, normalizeAmount } from './money';
import type { SettlementRoutingDecision, SettlementRoutingInput } from './types';

export function resolveSettlementRouting(input: SettlementRoutingInput): SettlementRoutingDecision {
  const ownGateway = input.ownGateway;
  if (!ownGateway && (!input.morEnabled || input.kycStatus !== 'approved')) {
    throw invalidMorRequest();
  }

  if (!input.morEnabled) {
    if (!ownGateway) throw invalidMorRequest();
    return {
      settlementPath: 'own_gateway',
      gateway: ownGateway,
      fallbackGateways: input.fallbackGateways,
      reason: 'mor_disabled',
    };
  }
  if (input.kycStatus !== 'approved') {
    if (!ownGateway) throw kycRequired();
    return {
      settlementPath: 'own_gateway',
      gateway: ownGateway,
      fallbackGateways: input.fallbackGateways,
      reason: 'kyc_not_approved',
    };
  }
  if (
    !input.morAgreement ||
    input.morAgreement.status !== 'active' ||
    !input.morAgreement.feeRuleId.trim() ||
    !input.morAgreement.agreementVersion.trim() ||
    !input.morAgreement.termsSnapshotHash.trim() ||
    !input.morAgreement.acceptedAt ||
    !input.morAgreement.kycApprovedAt
  ) {
    if (!ownGateway) throw morNotEligible();
    return {
      settlementPath: 'own_gateway',
      gateway: ownGateway,
      fallbackGateways: input.fallbackGateways,
      reason: 'mor_agreement_missing',
    };
  }
  if (input.riskSuspended) {
    if (!ownGateway) throw morNotEligible();
    return {
      settlementPath: 'own_gateway',
      gateway: ownGateway,
      fallbackGateways: input.fallbackGateways,
      reason: 'mor_risk_suspended',
    };
  }
  if (input.morMaximumPaymentAmount !== null) {
    const amount = normalizeAmount(input.paymentAmount);
    const maximum = normalizeAmount(input.morMaximumPaymentAmount, { allowZero: true });
    if (compareAmounts(amount, maximum) > 0) {
      if (!ownGateway) throw morNotEligible();
      return {
        settlementPath: 'own_gateway',
        gateway: ownGateway,
        fallbackGateways: input.fallbackGateways,
        reason: 'mor_amount_limit_exceeded',
      };
    }
  }
  return {
    settlementPath: 'platform_mor',
    gateway: input.morAgreement.platformGateway,
    fallbackGateways: input.fallbackGateways,
    reason: 'mor_active',
  };
}
