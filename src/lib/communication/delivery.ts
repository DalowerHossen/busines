import type {
  CommunicationAdapter,
  CommunicationChannel,
  ProviderMessageResult,
  SendTextMessageRequest,
} from './types';

export interface DeliveryClaimStore {
  /** Atomically claims the company/channel/idempotency key. */
  claim(input: {
    readonly companyId: string;
    readonly channel: CommunicationChannel;
    readonly idempotencyKey: string;
  }): Promise<boolean>;
  markSending(idempotencyKey: string): Promise<void>;
  markSent(idempotencyKey: string, result: ProviderMessageResult): Promise<void>;
  markFailed(idempotencyKey: string, retryable: boolean): Promise<void>;
}

export interface IdempotentDeliveryResult {
  readonly duplicate: boolean;
  readonly sent: boolean;
  readonly providerResult: ProviderMessageResult | null;
}

export async function sendClaimedMessage(input: {
  readonly companyId: string;
  readonly adapter: CommunicationAdapter;
  readonly request: SendTextMessageRequest;
  readonly store: DeliveryClaimStore;
}): Promise<IdempotentDeliveryResult> {
  const claimed = await input.store.claim({
    companyId: input.companyId,
    channel: input.adapter.channel,
    idempotencyKey: input.request.idempotencyKey,
  });
  if (!claimed) {
    return { duplicate: true, sent: false, providerResult: null };
  }

  await input.store.markSending(input.request.idempotencyKey);
  try {
    const result = await input.adapter.sendText(input.request);
    await input.store.markSent(input.request.idempotencyKey, result);
    return { duplicate: false, sent: true, providerResult: result };
  } catch (error) {
    const retryable =
      typeof error === 'object' &&
      error !== null &&
      'retryable' in error &&
      (error as { readonly retryable?: unknown }).retryable === true;
    await input.store.markFailed(input.request.idempotencyKey, retryable);
    throw new Error(
      'Communication delivery failed; the delivery record contains the retry decision.'
    );
  }
}
