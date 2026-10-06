// src/lib/payments/status.ts
// Provider status conversion is kept explicit so the database never receives
// an arbitrary provider string as a platform lifecycle value.
import type { PaymentStatus, RefundStatus } from '@/types/payment';
import type { PayoutStatus } from './types';

export function mapPaymentStatus(value: string | null): PaymentStatus {
  switch (value?.toLowerCase()) {
    case 'succeeded':
    case 'paid':
    case 'completed':
    case 'complete':
    case 'captured':
    case 'approved':
    case 'transaction.completed':
    case 'payment_succeeded':
      return 'captured';
    case 'requires_capture':
    case 'authorized':
    case 'auth':
      return 'authorized';
    case 'canceled':
    case 'cancelled':
    case 'voided':
      return 'cancelled';
    case 'failed':
    case 'declined':
    case 'rejected':
    case 'expired':
    case 'payment_failed':
      return 'failed';
    case 'disputed':
    case 'chargeback':
      return 'disputed';
    case 'refunded':
      return 'refunded';
    default:
      return 'pending';
  }
}

export function mapPayoutStatus(value: string | null): PayoutStatus {
  switch (value?.toLowerCase()) {
    case 'succeeded':
    case 'success':
    case 'paid':
    case 'completed':
    case 'approved':
      return 'succeeded';
    case 'processing':
    case 'in_progress':
      return 'processing';
    case 'failed':
    case 'declined':
    case 'rejected':
      return 'failed';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

export function mapRefundStatus(value: string | null): RefundStatus {
  switch (value?.toLowerCase()) {
    case 'succeeded':
    case 'approved':
    case 'complete':
    case 'completed':
      return 'succeeded';
    case 'failed':
    case 'declined':
    case 'rejected':
      return 'failed';
    case 'processing':
    case 'pending_approval':
    case 'pending':
      return 'processing';
    default:
      return 'pending';
  }
}
