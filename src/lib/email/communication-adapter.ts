import 'server-only';

import type {
  CommunicationAdapter,
  ProviderMessageResult,
  SendTextMessageRequest,
} from '@/lib/communication/types';
import type { EmailAdapter } from './types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replaceAll('\n', '<br>');
}

export function asCommunicationEmailAdapter(input: {
  readonly adapter: EmailAdapter;
  readonly subject: string;
  readonly from?: string;
  readonly replyTo?: string;
}): CommunicationAdapter {
  return {
    channel: 'email',
    async sendText(request: SendTextMessageRequest): Promise<ProviderMessageResult> {
      const result = await input.adapter.sendEmail({
        to: [request.recipient],
        subject: input.subject,
        html: `<p>${escapeHtml(request.body)}</p>`,
        text: request.body,
        from: input.from,
        replyTo: input.replyTo,
        idempotencyKey: request.idempotencyKey,
      });
      return {
        providerMessageId: result.providerMessageId,
        status: result.status,
        providerStatus: result.providerStatus,
        raw: { provider: result.provider },
      };
    },
  };
}
