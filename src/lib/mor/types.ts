import type { GatewayId, SettlementPath } from '@/types/payment';

export type KycStatus = 'not_started' | 'pending_review' | 'approved' | 'rejected';
export type KycDocumentType = 'id_front' | 'id_back' | 'business_registration';
export type KycDocumentStatus = 'pending' | 'accepted' | 'rejected';
export type MorAgreementStatus = 'pending' | 'active' | 'suspended' | 'terminated' | 'expired';
export type WalletBucket = 'available' | 'held' | 'pending';
export type WalletTransactionType =
  | 'payment_capture'
  | 'platform_fee'
  | 'hold_created'
  | 'hold_released'
  | 'payout'
  | 'refund'
  | 'chargeback'
  | 'chargeback_reversal'
  | 'adjustment';
export type PayoutStatus =
  | 'requested'
  | 'under_review'
  | 'approved'
  | 'processing'
  | 'paid'
  | 'rejected'
  | 'failed'
  | 'cancelled';
export type ChargebackStatus = 'open' | 'evidence_submitted' | 'won' | 'lost';
export type EvidenceRetentionAction = 'retain' | 'eligible_for_deletion';
export type CardFeeTier = 'domestic_us_standard' | 'premium_international_corporate';

export interface KycDocumentInput {
  readonly documentType: KycDocumentType;
  readonly providerFileId: string;
  readonly originalFileName: string;
  readonly mimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
  readonly sizeBytes: number;
  readonly contentSha256?: string;
}

export interface KycReviewInput {
  readonly companyId: string;
  readonly submissionId: string;
  readonly currentStatus: KycStatus;
  readonly documents: readonly {
    readonly documentType: KycDocumentType;
    readonly status: KycDocumentStatus;
  }[];
  readonly decision: 'approve' | 'reject';
  readonly reviewerUserId: string;
  readonly rejectionReason?: string;
  readonly reviewerNotes?: string;
  readonly reviewedAt: string;
}

export interface KycReviewDecision {
  readonly submissionId: string;
  readonly status: 'approved' | 'rejected';
  readonly reviewedByUserId: string;
  readonly reviewedAt: string;
  readonly rejectionReason: string | null;
  readonly reviewerNotes: string | null;
}

export interface FeeRule {
  readonly id: string;
  readonly companyId: string | null;
  readonly ruleName: string;
  readonly cardFeeTier: CardFeeTier;
  readonly percentageRate: string;
  readonly minimumFeeAmount: string;
  readonly fixedFeeAmount: string;
  readonly currencyCode: string;
  readonly holdPeriodDays: number;
  readonly payoutSlaHours: number;
  readonly minimumPayoutAmount: string;
  readonly isActive: boolean;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
}

export interface FeeCalculation {
  readonly ruleId: string;
  readonly cardFeeTier: CardFeeTier;
  readonly currencyCode: string;
  readonly paymentAmount: string;
  readonly percentageRate: string;
  readonly percentageFeeAmount: string;
  readonly minimumFeeAmount: string;
  readonly fixedFeeAmount: string;
  readonly chargedFeeAmount: string;
}

export interface MorAgreementSnapshot {
  readonly status: MorAgreementStatus;
  readonly agreementVersion: string;
  readonly feeRuleId: string;
  readonly platformGateway: Exclude<GatewayId, 'manual_bank_transfer' | 'custom'>;
  readonly acceptedAt: string | null;
  readonly kycApprovedAt: string | null;
  readonly termsSnapshotHash: string;
}

export interface SettlementRoutingInput {
  readonly kycStatus: KycStatus;
  readonly morEnabled: boolean;
  readonly morAgreement: MorAgreementSnapshot | null;
  readonly riskSuspended: boolean;
  readonly paymentAmount: string;
  readonly currencyCode: string;
  readonly morMaximumPaymentAmount: string | null;
  readonly ownGateway: Exclude<GatewayId, 'manual_bank_transfer'> | null;
  readonly fallbackGateways: readonly Exclude<GatewayId, 'manual_bank_transfer'>[];
}

export interface SettlementRoutingDecision {
  readonly settlementPath: SettlementPath;
  readonly gateway: Exclude<GatewayId, 'manual_bank_transfer'>;
  readonly fallbackGateways: readonly Exclude<GatewayId, 'manual_bank_transfer'>[];
  readonly reason:
    | 'mor_active'
    | 'mor_disabled'
    | 'kyc_not_approved'
    | 'mor_agreement_missing'
    | 'mor_risk_suspended'
    | 'mor_amount_limit_exceeded'
    | 'own_gateway_missing';
}

export interface WalletBalance {
  readonly available: string;
  readonly held: string;
  readonly pending: string;
  readonly version: number;
}

export interface WalletDelta {
  readonly available: string;
  readonly held: string;
  readonly pending: string;
}

export interface WalletTransition {
  readonly transactionType: WalletTransactionType;
  readonly idempotencyKey: string | null;
  readonly currencyCode: string;
  readonly before: WalletBalance;
  readonly delta: WalletDelta;
  readonly after: WalletBalance;
  readonly totalAmount: string;
  readonly referenceType: string | null;
  readonly referenceId: string | null;
}

export interface PaymentHoldInput {
  readonly companyId: string;
  readonly walletAccountId: string;
  readonly paymentId: string;
  readonly currencyCode: string;
  readonly amount: string;
  readonly holdUntil: string;
  readonly reason?: string;
}

export interface PaymentHoldRecord extends PaymentHoldInput {
  readonly status: 'held' | 'partially_released' | 'released' | 'cancelled';
  readonly releasedAmount: string;
  readonly releasedAt: string | null;
}

export interface PayoutRequestInput {
  readonly companyId: string;
  readonly walletAccountId: string;
  readonly payoutDestinationId: string;
  readonly currencyCode: string;
  readonly requestedAmount: string;
  readonly feeRule: FeeRule;
  readonly availableBalance: string;
  readonly requestedByUserId: string;
  readonly idempotencyKey: string;
}

export interface ChargebackReserveCalculation {
  readonly currencyCode: string;
  readonly chargebackAmount: string;
  readonly reservePercentage: string;
  readonly targetReserveAmount: string;
  readonly existingReserveAmount: string;
  readonly additionalReserveAmount: string;
  readonly releasableReserveAmount: string;
}

export interface DisputeRateCalculation {
  readonly chargebackCount: number;
  readonly eligiblePaymentCount: number;
  readonly disputeRatePercentage: string;
  readonly alertThresholdPercentage: string;
  readonly thresholdExceeded: boolean;
}

export interface EvidenceRetentionDecision {
  readonly action: EvidenceRetentionAction;
  readonly retentionPolicyVersion: string;
  readonly retentionUntil: string;
  readonly reason: 'active_dispute' | 'legal_hold' | 'within_retention_window' | 'window_expired';
}

export interface PayoutRequestDecision {
  readonly status: 'requested' | 'under_review' | 'approved';
  readonly companyId: string;
  readonly walletAccountId: string;
  readonly payoutDestinationId: string;
  readonly currencyCode: string;
  readonly requestedAmount: string;
  readonly platformFeeAmount: string;
  readonly netPayoutAmount: string;
  readonly minimumPayoutAmount: string;
  readonly requestedByUserId: string;
  readonly reviewedByUserId: string | null;
  readonly idempotencyKey: string;
}

export interface ConsentRecordInput {
  readonly companyId: string;
  readonly documentType: 'invoice' | 'estimate';
  readonly documentId: string;
  readonly clientId: string;
  readonly consentCheckboxAccepted: boolean;
  readonly receivedGoodsOrServicesConfirmed: boolean;
  readonly invoiceDetailsReadConfirmed: boolean;
  readonly consentTextSnapshot: string;
  readonly termsVersion?: string;
  readonly termsTextSnapshot?: string;
  readonly refundPolicyVersion?: string;
  readonly refundPolicyTextSnapshot?: string;
  readonly consentedAt: string;
  readonly ipAddress?: string;
  readonly geoCountryCode?: string;
  readonly geoRegion?: string;
  readonly geoCity?: string;
  readonly userAgent?: string;
  readonly deviceFingerprint?: string;
}

export interface ImmutableConsentRecord extends ConsentRecordInput {
  readonly recordHash: string;
}

export interface DeliveryAcceptanceRecord {
  readonly companyId: string;
  readonly documentType: 'invoice' | 'estimate';
  readonly documentId: string;
  readonly deliveryConfirmedAt: string | null;
  readonly trackingNumber: string | null;
  readonly serviceCompletedAt: string | null;
  readonly clientAcknowledgedAt: string | null;
  readonly clientAcceptedViaLinkAt: string | null;
  readonly clientEsignatureProviderFileId: string | null;
  readonly deliveryProofProviderFileId: string | null;
}

export interface DisputeAuditEventInput {
  readonly companyId: string;
  readonly documentType: 'invoice' | 'estimate';
  readonly documentId: string;
  readonly eventType: string;
  readonly eventData: Readonly<Record<string, unknown>>;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly occurredAt: string;
}

export interface DisputeAuditEvent extends DisputeAuditEventInput {
  readonly previousEventHash: string | null;
  readonly eventHash: string;
}

export interface EvidencePackInput {
  readonly companyId: string;
  readonly chargebackId: string;
  readonly paymentId: string;
  readonly documentType: 'invoice' | 'estimate';
  readonly documentId: string;
  readonly format: 'generic' | 'stripe' | 'paypal';
  readonly generatedByUserId: string;
  readonly generatedAt: string;
  readonly invoiceSnapshot: Readonly<Record<string, unknown>>;
  readonly consent: ImmutableConsentRecord | null;
  readonly delivery: DeliveryAcceptanceRecord | null;
  readonly auditEvents: readonly DisputeAuditEvent[];
  readonly emailProofs: readonly Readonly<Record<string, unknown>>[];
  readonly attachmentProofs: readonly Readonly<Record<string, unknown>>[];
  readonly renderedPdfSha256: string | null;
}

export interface EvidencePackBundle {
  readonly format: EvidencePackInput['format'];
  readonly manifest: Readonly<Record<string, unknown>>;
  readonly canonicalJson: string;
  readonly reviewHtml: string;
  readonly contentSha256: string;
}
