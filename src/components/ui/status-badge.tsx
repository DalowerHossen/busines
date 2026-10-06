// src/components/ui/status-badge.tsx
// Turns a database status into the badge a person reads. One mapping is used
// everywhere, so an invoice looks the same in a list, on a page and in a
// report.

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { humanise } from '@/lib/format';
import type {
  CompanyStatus,
  DisputeStatus,
  EstimateStatus,
  InvoiceStatus,
  KycStatus,
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
  SubscriptionStatus,
  UserStatus,
} from '@/types/enums';

type Tone = NonNullable<BadgeProps['tone']>;

const INVOICE_TONES: Readonly<Record<InvoiceStatus, Tone>> = {
  draft: 'neutral',
  scheduled: 'info',
  sent: 'info',
  viewed: 'info',
  partially_paid: 'warning',
  paid: 'success',
  overdue: 'danger',
  disputed: 'danger',
  written_off: 'neutral',
  cancelled: 'neutral',
};

const ESTIMATE_TONES: Readonly<Record<EstimateStatus, Tone>> = {
  draft: 'neutral',
  sent: 'info',
  viewed: 'info',
  approved: 'success',
  declined: 'danger',
  expired: 'warning',
  converted: 'brand',
  cancelled: 'neutral',
};

const PAYMENT_TONES: Readonly<Record<PaymentStatus, Tone>> = {
  pending: 'warning',
  requires_action: 'warning',
  authorized: 'info',
  processing: 'info',
  succeeded: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  partially_refunded: 'warning',
  refunded: 'neutral',
  disputed: 'danger',
  charged_back: 'danger',
};

const REFUND_TONES: Readonly<Record<RefundStatus, Tone>> = {
  requested: 'warning',
  processing: 'info',
  succeeded: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

const DISPUTE_TONES: Readonly<Record<DisputeStatus, Tone>> = {
  open: 'danger',
  evidence_required: 'warning',
  evidence_submitted: 'info',
  under_review: 'info',
  won: 'success',
  lost: 'danger',
  withdrawn: 'neutral',
};

const PAYOUT_TONES: Readonly<Record<PayoutStatus, Tone>> = {
  requested: 'warning',
  under_review: 'warning',
  approved: 'info',
  processing: 'info',
  completed: 'success',
  failed: 'danger',
  rejected: 'danger',
  cancelled: 'neutral',
};

const SUBSCRIPTION_TONES: Readonly<Record<SubscriptionStatus, Tone>> = {
  trialing: 'info',
  active: 'success',
  past_due: 'warning',
  paused: 'neutral',
  cancelled: 'neutral',
  expired: 'danger',
};

const COMPANY_TONES: Readonly<Record<CompanyStatus, Tone>> = {
  onboarding: 'info',
  trialing: 'info',
  active: 'success',
  past_due: 'warning',
  suspended: 'danger',
  read_only: 'warning',
  closed: 'neutral',
};

const USER_TONES: Readonly<Record<UserStatus, Tone>> = {
  pending_verification: 'warning',
  active: 'success',
  suspended: 'danger',
  banned: 'danger',
  closed: 'neutral',
};

const KYC_TONES: Readonly<Record<KycStatus, Tone>> = {
  not_started: 'neutral',
  in_progress: 'info',
  submitted: 'info',
  under_review: 'warning',
  verified: 'success',
  rejected: 'danger',
  expired: 'warning',
};

export type StatusKind =
  | 'invoice'
  | 'estimate'
  | 'payment'
  | 'refund'
  | 'dispute'
  | 'payout'
  | 'subscription'
  | 'company'
  | 'user'
  | 'kyc';

export interface StatusBadgeProps {
  /** Which family of statuses the value belongs to. */
  kind: StatusKind;
  /** The status value as stored in the database. */
  status: string;
  /** Extra classes for the badge. */
  className?: string;
}

/**
 * Chooses the colour for a status.
 *
 * @param kind Family of statuses.
 * @param status Status value.
 * @returns The badge tone.
 */
function toneFor(kind: StatusKind, status: string): Tone {
  switch (kind) {
    case 'invoice':
      return INVOICE_TONES[status as InvoiceStatus] ?? 'neutral';
    case 'estimate':
      return ESTIMATE_TONES[status as EstimateStatus] ?? 'neutral';
    case 'payment':
      return PAYMENT_TONES[status as PaymentStatus] ?? 'neutral';
    case 'refund':
      return REFUND_TONES[status as RefundStatus] ?? 'neutral';
    case 'dispute':
      return DISPUTE_TONES[status as DisputeStatus] ?? 'neutral';
    case 'payout':
      return PAYOUT_TONES[status as PayoutStatus] ?? 'neutral';
    case 'subscription':
      return SUBSCRIPTION_TONES[status as SubscriptionStatus] ?? 'neutral';
    case 'company':
      return COMPANY_TONES[status as CompanyStatus] ?? 'neutral';
    case 'user':
      return USER_TONES[status as UserStatus] ?? 'neutral';
    case 'kyc':
      return KYC_TONES[status as KycStatus] ?? 'neutral';
    default:
      return 'neutral';
  }
}

/**
 * Renders a status as a coloured badge with a readable label.
 *
 * @param props Status family and value.
 * @returns The rendered badge.
 */
export function StatusBadge({ kind, status, className }: StatusBadgeProps) {
  return (
    <Badge tone={toneFor(kind, status)} className={className}>
      {humanise(status)}
    </Badge>
  );
}
