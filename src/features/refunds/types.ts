// src/features/refunds/types.ts
// The shapes the refund module works with: money given back, and the ones
// still waiting for somebody to approve them.

import type { ApprovalStatus, GatewayProvider, RefundStatus } from '@/types/enums';

export interface RefundSummary {
  id: string;
  refundNumber: string | null;
  status: RefundStatus;
  approvalStatus: ApprovalStatus | null;
  requiresApproval: boolean;
  paymentId: string;
  paymentNumber: string | null;
  clientName: string;
  amount: string;
  currency: string;
  reason: string;
  provider: GatewayProvider;
  isPartial: boolean;
  requestedAt: string;
  settledAt: string | null;
  rejectionReason: string | null;
}

export interface RefundTotals {
  /** Money given back and settled. */
  settledAmount: string;
  /** Money promised but still waiting for approval. */
  pendingAmount: string;
  /** How many refunds are waiting for a decision. */
  pendingCount: number;
  /** Currency the totals are shown in. */
  currency: string;
}

export interface RefundOverview {
  refunds: readonly RefundSummary[];
  totals: RefundTotals;
  /** True when the refunds could not be read. */
  isDegraded: boolean;
}
