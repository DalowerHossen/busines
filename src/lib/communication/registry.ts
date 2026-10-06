import 'server-only';

import { CommunicationProviderError } from './http';
import { TelegramBotAdapter } from './telegram';
import { TwilioSmsAdapter } from './twilio-sms';
import type { CommunicationAdapter, CommunicationAdapterOptions } from './types';
import { ViberBotAdapter } from './viber';
import { WhatsAppCloudAdapter } from './whatsapp';
import type { TelegramBotConfig } from './telegram';
import type { TwilioMessagingConfig } from './twilio-sms';
import type { ViberBotConfig } from './viber';
import type { WhatsAppCloudConfig } from './whatsapp';

export type CommunicationAdapterConfig =
  | { readonly channel: 'whatsapp'; readonly config: WhatsAppCloudConfig }
  | { readonly channel: 'sms'; readonly config: TwilioMessagingConfig }
  | { readonly channel: 'telegram'; readonly config: TelegramBotConfig }
  | { readonly channel: 'viber'; readonly config: ViberBotConfig };

export function createCommunicationAdapter(
  input: CommunicationAdapterConfig,
  options: CommunicationAdapterOptions = {}
): CommunicationAdapter {
  switch (input.channel) {
    case 'whatsapp':
      return new WhatsAppCloudAdapter(input.config, options);
    case 'sms':
      return new TwilioSmsAdapter(input.config, options);
    case 'telegram':
      return new TelegramBotAdapter(input.config, options);
    case 'viber':
      return new ViberBotAdapter(input.config, options);
  }
}

export function requireCommunicationAdapter(
  input: CommunicationAdapterConfig | null,
  options: CommunicationAdapterOptions = {}
): CommunicationAdapter {
  if (input === null) {
    throw new CommunicationProviderError('communication', null, false);
  }
  return createCommunicationAdapter(input, options);
}
