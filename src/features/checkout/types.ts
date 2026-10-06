// src/features/checkout/types.ts
// What a client sees when they come to pay an invoice. Nothing here names a
// secret or anything about the business beyond the document itself.

import type { GatewayProvider } from '@/types/enums';

export interface CheckoutMethod {
  /** Identifier of the connection the payment would run through. */
  gatewayId: string;
  provider: GatewayProvider;
  /** What the client is told this method is called. */
  label: string;
  /** One sentence about how the method works. */
  description: string;
  /** Extra wording the business added for this method. */
  instructions: string | null;
  /** True when the client is sent to the provider rather than staying here. */
  redirectsAway: boolean;
}

export interface CheckoutInvoice {
  id: string;
  number: string;
  currency: string;
  balanceDue: string;
  dueDate: string | null;
  payerEmail: string | null;
  supplierName: string;
}

/** The conditions the seller attached to being paid by card. */
export interface CheckoutTerms {
  /** The sentence the payer has to agree to before paying. */
  consentStatement: string;
  /** True when the seller also wants their terms ticked. */
  requireTermsAcceptance: boolean;
  /** True when a billing address is asked for. */
  requireBillingAddress: boolean;
  /** True when the payer is asked to confirm the work arrived. */
  requireDeliveryConfirmation: boolean;
  /** Days within which the seller offers a refund. */
  refundWindowDays: number;
}

export interface CheckoutSuccess {
  isAvailable: true;
  invoice: CheckoutInvoice;
  methods: readonly CheckoutMethod[];
  /** True when the invoice has nothing left to pay. */
  isSettled: boolean;
  /** What the payer has to agree to, and what they must provide. */
  terms: CheckoutTerms;
}

export interface CheckoutFailure {
  isAvailable: false;
  /** A sentence the client can act on. */
  message: string;
}

export type CheckoutResult = CheckoutSuccess | CheckoutFailure;
