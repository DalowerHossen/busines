// src/types/payment.ts
// Payment-family domain types: payments, saved payment methods, refunds,
// chargebacks, and the pluggable gateway identifier shared by every
// adapter. Concrete gateway adapters live in `src/lib/payments/`;
// this file only defines the shapes every adapter produces and consumes.
// PCI SAQ-A scope: raw card data is never represented here or anywhere in
// this codebase, only gateway-issued tokens and references (see
// docs/planning/ARCHITECTURE-DECISIONS.md section 9).
import type { ISODateString, Money, TenantScopedEntity, UUID } from '@/types/core';

/**
 * Every payment gateway the platform ships an adapter for, plus the two
 * configurable local payment rails and a generic custom-gateway slot. See
 * docs/planning/ARCHITECTURE-DECISIONS.md section 4: gateway identifiers
 * are configuration/internal values only and must never be printed as a
 * specific provider brand name in public-facing UI copy.
 */
export type GatewayId =
  | 'stripe'
  | 'paypal'
  | 'paddle'
  | 'nmi'
  | 'two_checkout'
  | 'adyen_for_platforms'
  | 'nium'
  | 'local_rail_1'
  | 'local_rail_2'
  | 'manual_bank_transfer'
  | 'custom';

/**
 * Whether a payment was collected through the owner's own gateway keys
 * (the default path) or through the platform's Merchant-of-Record gateway
 * (KYC-gated opt-in). See docs/planning/ARCHITECTURE-DECISIONS.md section 6.
 */
export type SettlementPath = 'own_gateway' | 'platform_mor';

/**
 * Lifecycle status of a payment attempt.
 */
export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'disputed'
  | 'cancelled';

/**
 * A tokenized, saved payment method reference (for example a Stripe
 * `payment_method` id). No raw card number, CVV, or expiry is ever stored;
 * only the gateway-issued token and display-safe metadata.
 */
export interface SavedPaymentMethod extends TenantScopedEntity {
  readonly clientId: UUID;
  readonly gateway: GatewayId;
  readonly gatewayToken: string;
  readonly cardBrand: string | null;
  readonly cardLastFourDigits: string | null;
  readonly expiryMonth: number | null;
  readonly expiryYear: number | null;
  readonly isDefault: boolean;
}

/**
 * A single payment transaction against an invoice (or a standalone payment
 * link not tied to any invoice).
 */
export interface Payment extends TenantScopedEntity {
  readonly invoiceId: UUID | null;
  readonly clientId: UUID;
  readonly gateway: GatewayId;
  readonly settlementPath: SettlementPath;
  readonly status: PaymentStatus;
  readonly amount: Money;
  /** The platform's own per-transaction fee, charged in addition to the gateway's own fee. */
  readonly platformFee: Money;
  readonly gatewayTransactionId: string | null;
  readonly savedPaymentMethodId: UUID | null;
  readonly is3dsEnabled: boolean;
  readonly receiptSentAt: ISODateString | null;
  readonly authorizedAt: ISODateString | null;
  readonly capturedAt: ISODateString | null;
  readonly failureReason: string | null;
}

/**
 * Lifecycle status of a refund request.
 */
export type RefundStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

/**
 * A full or partial refund issued against a {@link Payment}.
 */
export interface Refund extends TenantScopedEntity {
  readonly paymentId: UUID;
  readonly status: RefundStatus;
  readonly amount: Money;
  readonly reason: string | null;
  readonly initiatedByUserId: UUID;
  readonly gatewayRefundId: string | null;
  readonly processedAt: ISODateString | null;
}

/**
 * Lifecycle status of a chargeback/dispute raised by a client's bank.
 */
export type ChargebackStatus = 'open' | 'evidence_submitted' | 'won' | 'lost';

/**
 * A chargeback/dispute against a {@link Payment}. The evidence pack itself
 * (consent, delivery proof, audit timeline) is defined in the dedicated
 * dispute-evidence types added alongside its own migration phase; this
 * record only tracks the chargeback's own lifecycle and linkage.
 */
export interface Chargeback extends TenantScopedEntity {
  readonly paymentId: UUID;
  readonly status: ChargebackStatus;
  readonly amount: Money;
  readonly reasonCode: string;
  readonly gatewayCaseId: string | null;
  readonly respondByDate: ISODateString | null;
  readonly resolvedAt: ISODateString | null;
}

/**
 * A raw inbound webhook event from any gateway, persisted before
 * processing so delivery is idempotent and replayable. `payload` is the
 * verified, parsed JSON body; raw-body signature verification happens
 * before this record is created.
 */
export interface GatewayWebhookEvent {
  readonly id: UUID;
  readonly gateway: GatewayId;
  readonly eventType: string;
  readonly gatewayEventId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly receivedAt: ISODateString;
  readonly processedAt: ISODateString | null;
  readonly processingError: string | null;
}
