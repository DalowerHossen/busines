import 'server-only';

import { sendPlatformMail } from './platform-mail';
import type {
  EmailAdapter,
  EmailFailureLogger,
  PlatformMailResult,
  SendEmailRequest,
} from './types';

export interface EmailDeliveryClaimStore {
  /** Atomically claims the company/idempotency key before any provider call. */
  claim(input: { readonly companyId: string; readonly idempotencyKey: string }): Promise<boolean>;
  markSending(idempotencyKey: string): Promise<void>;
  markSent(idempotencyKey: string, providerMessageId: string): Promise<void>;
  markFailed(idempotencyKey: string, retryable: boolean, failureCode: string | null): Promise<void>;
}

export interface QueuedEmailResult {
  readonly duplicate: boolean;
  readonly result: PlatformMailResult | null;
}

export async function processClaimedEmail(input: {
  readonly companyId: string;
  readonly adapter: EmailAdapter;
  readonly request: SendEmailRequest;
  readonly store: EmailDeliveryClaimStore;
  readonly failureLogger?: EmailFailureLogger;
}): Promise<QueuedEmailResult> {
  const claimed = await input.store.claim({
    companyId: input.companyId,
    idempotencyKey: input.request.idempotencyKey,
  });
  if (!claimed) {
    return { duplicate: true, result: null };
  }

  await input.store.markSending(input.request.idempotencyKey);
  const result = await sendPlatformMail({
    adapter: input.adapter,
    request: input.request,
    failureLogger: input.failureLogger,
  });
  if (result.sent && result.providerMessageId) {
    await input.store.markSent(input.request.idempotencyKey, result.providerMessageId);
  } else {
    await input.store.markFailed(
      input.request.idempotencyKey,
      result.retryable,
      result.failureCode
    );
  }
  return { duplicate: false, result };
}
