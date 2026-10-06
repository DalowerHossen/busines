import type { CommunicationMessageStatus } from './types';

const STATUS_RANK: Readonly<Record<CommunicationMessageStatus, number>> = {
  queued: 0,
  sending: 1,
  sent: 2,
  delivered: 3,
  read: 4,
  failed: 5,
  cancelled: 5,
};

export function normalizeProviderStatus(value: string | null): CommunicationMessageStatus {
  switch (value?.toLowerCase()) {
    case 'queued':
    case 'accepted':
      return 'queued';
    case 'sending':
    case 'processing':
      return 'sending';
    case 'sent':
    case 'submitted':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'read':
    case 'seen':
      return 'read';
    case 'failed':
    case 'undelivered':
    case 'rejected':
      return 'failed';
    default:
      return 'sent';
  }
}

export function advanceMessageStatus(
  current: CommunicationMessageStatus,
  incoming: CommunicationMessageStatus
): CommunicationMessageStatus {
  if (current === 'cancelled' || current === 'read') {
    return current;
  }
  if (incoming === 'failed') {
    return current === 'delivered' ? current : 'failed';
  }
  return STATUS_RANK[incoming] >= STATUS_RANK[current] ? incoming : current;
}
