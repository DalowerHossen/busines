// src/lib/messaging/providers/registry.ts
// Turning the provider recorded on a channel into something that can send.
// A provider nobody has written code for falls through to the configurable
// adapter, which is why a new supplier never needs a release.

import 'server-only';

import { chatBotAdapter } from '@/lib/messaging/providers/chat-bot';
import { configurableMessagingAdapter } from '@/lib/messaging/providers/configurable';
import { textMessageAdapter } from '@/lib/messaging/providers/text-message';
import type { MessagingAdapter, OutboundChannel } from '@/lib/messaging/providers/types';

/** The channels the platform can send on besides email. */
export const OUTBOUND_CHANNELS: readonly OutboundChannel[] = [
  'sms',
  'whatsapp',
  'telegram',
  'viber',
];

/**
 * Reports whether a channel is one this layer can send on.
 *
 * @param value Channel recorded on the message.
 * @returns True when the channel is not email and not in application.
 */
export function isOutboundChannel(value: string): value is OutboundChannel {
  return OUTBOUND_CHANNELS.includes(value as OutboundChannel);
}

/**
 * Picks the adapter for one channel.
 *
 * @param channel Channel the message is going out on.
 * @param provider Provider key stored with the channel.
 * @returns The adapter that knows how to speak to it.
 */
export function messagingAdapterFor(channel: OutboundChannel, provider: string): MessagingAdapter {
  if (provider === 'custom' || provider === 'configurable') {
    return configurableMessagingAdapter;
  }

  if (channel === 'telegram' || channel === 'viber') {
    return chatBotAdapter;
  }

  if (channel === 'sms' || channel === 'whatsapp') {
    return textMessageAdapter;
  }

  return configurableMessagingAdapter;
}
