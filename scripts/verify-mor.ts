import assert from 'node:assert/strict';
import {
  calculateChargebackReserve,
  calculateDisputeRate,
  decideEvidenceRetention,
} from '@/lib/mor/disputes';
import {
  appendDisputeAuditEvent,
  buildDisputeEvidencePack,
  capturePaymentConsent,
  verifyDisputeAuditChain,
} from '@/lib/mor/evidence-core';
import { calculatePlatformFee } from '@/lib/mor/fees';
import { isKycApproved, validateKycDocument, validateKycReview } from '@/lib/mor/kyc';
import { approvePayoutRequest, executePayout, requestPayout } from '@/lib/mor/payouts';
import { resolveSettlementRouting } from '@/lib/mor/routing';
import { createHoldReleaseTransition, createPaymentHoldTransition } from '@/lib/mor/wallet';
import type { FeeRule, WalletBalance } from '@/lib/mor/types';

const feeRule: FeeRule = {
  id: 'fee-rule-1',
  companyId: 'company-1',
  ruleName: 'Default platform fee',
  cardFeeTier: 'domestic_us_standard',
  percentageRate: '2.5',
  minimumFeeAmount: '1.00',
  fixedFeeAmount: '0.25',
  currencyCode: 'USD',
  holdPeriodDays: 7,
  payoutSlaHours: 24,
  minimumPayoutAmount: '10.00',
  isActive: true,
  effectiveFrom: '2026-01-01T00:00:00Z',
  effectiveUntil: null,
};

assert.equal(
  validateKycDocument({
    documentType: 'id_front',
    providerFileId: 'drive-file-1',
    originalFileName: 'identity.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    contentSha256: 'a'.repeat(64),
  }).providerFileId,
  'drive-file-1'
);
const review = validateKycReview({
  companyId: 'company-1',
  submissionId: 'submission-1',
  currentStatus: 'pending_review',
  documents: [
    { documentType: 'id_front', status: 'accepted' },
    { documentType: 'id_back', status: 'accepted' },
    { documentType: 'business_registration', status: 'accepted' },
  ],
  decision: 'approve',
  reviewerUserId: 'admin-1',
  reviewedAt: '2026-10-06T00:00:00Z',
});
assert.equal(review.status, 'approved');
assert.equal(isKycApproved('approved'), true);

const fee = calculatePlatformFee({ paymentAmount: '100.00', currencyCode: 'USD', rule: feeRule });
assert.equal(fee.percentageFeeAmount, '2.5000');
assert.equal(fee.chargedFeeAmount, '2.7500');

const reserve = calculateChargebackReserve({
  currencyCode: 'USD',
  chargebackAmount: '100.00',
  reservePercentage: '100.00',
  existingReserveAmount: '25.00',
});
assert.equal(reserve.targetReserveAmount, '100.0000');
assert.equal(reserve.additionalReserveAmount, '75.0000');
assert.equal(reserve.releasableReserveAmount, '0.0000');
const disputeRate = calculateDisputeRate({
  chargebackCount: 1,
  eligiblePaymentCount: 100,
  alertThresholdPercentage: '0.65',
});
assert.equal(disputeRate.disputeRatePercentage, '1.0000');
assert.equal(disputeRate.thresholdExceeded, true);
const expiredRetention = decideEvidenceRetention({
  createdAt: '2024-01-01T00:00:00Z',
  now: '2026-10-06T00:00:00Z',
  retentionMonths: 18,
  retentionPolicyVersion: 'evidence-retention-2026-1',
  disputeStatus: 'won',
  legalHold: false,
});
assert.equal(expiredRetention.action, 'eligible_for_deletion');
const activeRetention = decideEvidenceRetention({
  createdAt: '2024-01-01T00:00:00Z',
  now: '2026-10-06T00:00:00Z',
  retentionMonths: 18,
  retentionPolicyVersion: 'evidence-retention-2026-1',
  disputeStatus: 'open',
  legalHold: false,
});
assert.equal(activeRetention.action, 'retain');

const routing = resolveSettlementRouting({
  kycStatus: 'approved',
  morEnabled: true,
  morAgreement: {
    status: 'active',
    agreementVersion: '2026-1',
    feeRuleId: feeRule.id,
    platformGateway: 'stripe',
    acceptedAt: '2026-10-01T00:00:00Z',
    kycApprovedAt: '2026-10-01T00:00:00Z',
    termsSnapshotHash: 'b'.repeat(64),
  },
  riskSuspended: false,
  paymentAmount: '100.00',
  currencyCode: 'USD',
  morMaximumPaymentAmount: '500.00',
  ownGateway: 'paypal',
  fallbackGateways: ['paddle'],
});
assert.equal(routing.settlementPath, 'platform_mor');
assert.equal(routing.gateway, 'stripe');

const consent = capturePaymentConsent({
  companyId: 'company-1',
  documentType: 'invoice',
  documentId: 'invoice-1',
  clientId: 'client-1',
  consentCheckboxAccepted: true,
  receivedGoodsOrServicesConfirmed: true,
  invoiceDetailsReadConfirmed: true,
  consentTextSnapshot: 'I agree to pay this invoice.',
  termsVersion: 'terms-2026-1',
  termsTextSnapshot: 'Payment terms.',
  refundPolicyVersion: 'refund-2026-1',
  refundPolicyTextSnapshot: 'Refund policy.',
  consentedAt: '2026-10-06T00:00:00Z',
});
const firstAuditEvent = appendDisputeAuditEvent(null, {
  companyId: 'company-1',
  documentType: 'invoice',
  documentId: 'invoice-1',
  eventType: 'payment_captured',
  eventData: { paymentId: 'payment-1', cardNumber: '4111111111111111' },
  occurredAt: '2026-10-06T00:01:00Z',
});
const secondAuditEvent = appendDisputeAuditEvent(firstAuditEvent.eventHash, {
  companyId: 'company-1',
  documentType: 'invoice',
  documentId: 'invoice-1',
  eventType: 'delivery_confirmed',
  eventData: { deliveryProofId: 'proof-1' },
  occurredAt: '2026-10-06T00:02:00Z',
});
assert.equal(verifyDisputeAuditChain([firstAuditEvent, secondAuditEvent]), true);
assert.equal(
  verifyDisputeAuditChain([
    firstAuditEvent,
    { ...secondAuditEvent, eventData: { deliveryProofId: 'tampered' } },
  ]),
  false
);
const evidencePack = buildDisputeEvidencePack({
  companyId: 'company-1',
  chargebackId: 'chargeback-1',
  paymentId: 'payment-1',
  documentType: 'invoice',
  documentId: 'invoice-1',
  format: 'stripe',
  generatedByUserId: 'admin-1',
  generatedAt: '2026-10-06T00:03:00Z',
  invoiceSnapshot: { invoiceId: 'invoice-1', cardNumber: '4111111111111111' },
  consent,
  delivery: {
    companyId: 'company-1',
    documentType: 'invoice',
    documentId: 'invoice-1',
    deliveryConfirmedAt: '2026-10-06T00:02:00Z',
    trackingNumber: null,
    serviceCompletedAt: null,
    clientAcknowledgedAt: null,
    clientAcceptedViaLinkAt: null,
    clientEsignatureProviderFileId: null,
    deliveryProofProviderFileId: 'proof-1',
  },
  auditEvents: [firstAuditEvent, secondAuditEvent],
  emailProofs: [],
  attachmentProofs: [],
  renderedPdfSha256: 'c'.repeat(64),
});
assert.equal(evidencePack.manifest.consentHash, consent.recordHash);
assert.equal(evidencePack.canonicalJson.includes('4111111111111111'), false);

const openingBalance: WalletBalance = {
  available: '100.0000',
  held: '0.0000',
  pending: '0.0000',
  version: 1,
};
const hold = createPaymentHoldTransition({
  before: openingBalance,
  currencyCode: 'USD',
  amount: '20.00',
  paymentId: 'payment-1',
  idempotencyKey: 'hold-1',
});
assert.equal(hold.after.held, '20.0000');
const release = createHoldReleaseTransition({
  before: hold.after,
  currencyCode: 'USD',
  amount: '20.00',
  paymentHoldId: 'hold-1',
  idempotencyKey: 'release-1',
});
assert.equal(release.after.available, '100.0000');
assert.equal(release.after.held, '0.0000');
assert.equal(release.totalAmount, '0.0000');

requestPayout({
  request: {
    companyId: 'company-1',
    walletAccountId: 'wallet-1',
    payoutDestinationId: 'destination-1',
    currencyCode: 'USD',
    requestedAmount: '50.00',
    feeRule,
    availableBalance: '100.00',
    requestedByUserId: 'owner-1',
    idempotencyKey: 'payout-1',
  },
  destination: { id: 'destination-1', status: 'verified', currencyCode: 'USD' },
  store: {
    async findByIdempotency() {
      return null;
    },
    async create(input) {
      return input;
    },
  },
})
  .then(async (payoutResult) => {
    assert.equal(payoutResult.request.platformFeeAmount, '1.5000');
    assert.equal(payoutResult.request.netPayoutAmount, '48.5000');
    const approvedRequest = approvePayoutRequest({
      request: payoutResult.request,
      reviewerUserId: 'reviewer-1',
    });
    const execution = await executePayout({
      request: approvedRequest,
      destinationId: 'destination-1',
      rail: {
        async createPayout(input) {
          assert.equal(input.idempotencyKey, 'payout-1');
          return { providerPayoutId: 'provider-payout-1', status: 'paid' as const };
        },
      },
      store: {
        async markProcessing() {},
        async markPaid(input) {
          assert.equal(input.providerPayoutId, 'provider-payout-1');
        },
        async markFailed() {
          throw new Error('A paid payout must not be marked failed.');
        },
      },
    });
    assert.equal(execution.status, 'paid');
    process.stdout.write('MoR, KYC, wallet, fee, payout, and evidence smoke test passed.\n');
  })
  .catch((error: unknown) => {
    process.stderr.write(
      error instanceof Error ? `${error.message}\n` : 'MoR smoke test failed.\n'
    );
    process.exitCode = 1;
  });
