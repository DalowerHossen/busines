import type { CommunicationMessageStatus } from '@/lib/communication/types';
import type { EmailDeliveryEventStatus } from './webhooks';

export function emailEventToMessageStatus(
  status: EmailDeliveryEventStatus
): CommunicationMessageStatus {
  switch (status) {
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'opened':
    case 'clicked':
      return 'read';
    case 'delayed':
      return 'sent';
    case 'bounced':
    case 'complained':
    case 'failed':
    case 'suppressed':
      return 'failed';
  }
}
