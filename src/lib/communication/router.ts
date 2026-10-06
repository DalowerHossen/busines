import type {
  ClientChannelPreference,
  CommunicationAdapter,
  CommunicationChannel,
  ProviderMessageResult,
  RouteAttempt,
  RouteCandidate,
  RouteResult,
  SendTextMessageRequest,
} from './types';

function consentIsActive(preference: ClientChannelPreference, now: Date): boolean {
  if (!preference.isEnabled || preference.optedInAt === null) {
    return false;
  }
  const optedInAt = Date.parse(preference.optedInAt);
  const optedOutAt = preference.optedOutAt === null ? null : Date.parse(preference.optedOutAt);
  const nowTime = now.getTime();
  if (!Number.isFinite(optedInAt) || optedInAt > nowTime) {
    return false;
  }
  if (optedOutAt === null) {
    return true;
  }
  return Number.isFinite(optedOutAt) && optedOutAt > nowTime;
}

function uniqueChannels(
  channels: readonly CommunicationChannel[]
): readonly CommunicationChannel[] {
  return [...new Set(channels)];
}

function candidateFor(
  channel: CommunicationChannel,
  candidates: readonly RouteCandidate[]
): RouteCandidate | undefined {
  return candidates.find((candidate) => candidate.channel === channel);
}

export async function sendWithFallback(input: {
  readonly body: string;
  readonly idempotencyKey: string;
  readonly primaryChannel: CommunicationChannel;
  readonly fallbackChannels: readonly CommunicationChannel[];
  readonly candidates: readonly RouteCandidate[];
  readonly now?: Date;
  readonly statusCallbackUrl?: string;
}): Promise<RouteResult> {
  const now = input.now ?? new Date();
  const attempts: RouteAttempt[] = [];
  const routeChannels = uniqueChannels([input.primaryChannel, ...input.fallbackChannels]);

  for (const channel of routeChannels) {
    const candidate = candidateFor(channel, input.candidates);
    if (!candidate) {
      attempts.push({
        channel,
        recipient: '',
        status: 'skipped',
        reason: 'No client address is configured for this channel.',
        providerMessageId: null,
      });
      continue;
    }
    if (!consentIsActive(candidate, now)) {
      attempts.push({
        channel,
        recipient: candidate.address,
        status: 'skipped',
        reason: 'The client has not granted active opt-in for this channel.',
        providerMessageId: null,
      });
      continue;
    }
    if (!candidate.adapter) {
      attempts.push({
        channel,
        recipient: candidate.address,
        status: 'skipped',
        reason: 'No connected adapter is available for this channel.',
        providerMessageId: null,
      });
      continue;
    }

    const request: SendTextMessageRequest = {
      recipient: candidate.address,
      body: input.body,
      idempotencyKey: `${input.idempotencyKey}:${channel}`,
      statusCallbackUrl: input.statusCallbackUrl,
    };
    try {
      const providerResult = await candidate.adapter.sendText(request);
      attempts.push({
        channel,
        recipient: candidate.address,
        status: 'sent',
        reason: null,
        providerMessageId: providerResult.providerMessageId,
      });
      return {
        delivered: true,
        selectedChannel: channel,
        attempts,
        providerResult,
      };
    } catch {
      attempts.push({
        channel,
        recipient: candidate.address,
        status: 'failed',
        reason: 'The channel provider rejected or could not complete the message.',
        providerMessageId: null,
      });
    }
  }

  return {
    delivered: false,
    selectedChannel: null,
    attempts,
    providerResult: null,
  };
}

export function asRouteCandidates(
  preferences: readonly ClientChannelPreference[],
  adapters: ReadonlyMap<CommunicationChannel, CommunicationAdapter>
): readonly RouteCandidate[] {
  return [...preferences]
    .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary))
    .map((preference) => ({
      ...preference,
      adapter: adapters.get(preference.channel) ?? null,
    }));
}

export function providerResultStatus(result: ProviderMessageResult): 'sent' | 'failed' {
  return result.status === 'failed' ? 'failed' : 'sent';
}
