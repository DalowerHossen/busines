// src/features/disputes/types.ts
// The shapes the dispute module works with: a chargeback, its deadline and
// the evidence gathered to answer it.

import type { DisputeStatus, GatewayProvider } from '@/types/enums';

export interface DisputeSummary {
  id: string;
  status: DisputeStatus;
  provider: GatewayProvider;
  caseNumber: string | null;
  reasonCode: string | null;
  reasonDescription: string | null;
  clientName: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  paymentId: string;
  disputedAmount: string;
  feeAmount: string;
  recoveredAmount: string;
  currency: string;
  openedAt: string;
  evidenceDueAt: string | null;
  evidenceSubmittedAt: string | null;
  resolvedAt: string | null;
  outcomeNote: string | null;
}

export interface DisputeEvidenceItem {
  id: string;
  evidenceType: string;
  title: string;
  description: string | null;
  fileName: string | null;
  collectedAt: string;
  isIncluded: boolean;
}

export interface DisputeDetail extends DisputeSummary {
  evidence: readonly DisputeEvidenceItem[];
}

export interface DisputeTotals {
  /** How many chargebacks still need an answer. */
  openCount: number;
  /** Money at stake in the ones still open. */
  openAmount: string;
  /** Money that came back from the ones already decided. */
  recoveredAmount: string;
  currency: string;
}

export interface DisputeOverview {
  disputes: readonly DisputeSummary[];
  totals: DisputeTotals;
  /** True when the disputes could not be read. */
  isDegraded: boolean;
}
