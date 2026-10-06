// src/lib/messaging/providers/chat-bot.ts
// Chat applications. Two of them are supported out of the box: one that is
// driven by a bot token in the address, and one that is driven by a token in
// a header. Both take a recipient identifier and a line of text, so a single
// adapter with two shapes covers them.

import 'server-only';

import { logger } from '@/lib/logger';
import {
  callProvider,
  describeFailure,
  readSetting,
  type ChannelSendOutcome,
  type ChannelTestResult,
  type MessagingAdapter,
  type MessagingContext,
  type OutboundChannelMessage,
} from '@/lib/messaging/providers/types';

/** Default endpoints, overridable per channel so nothing is hard wired. */
const DEFAULTS = {
  telegram: {
    base: 'https://api.telegram.org',
    sendPath: '/bot{token}/sendMessage',
    testPath: '/bot{token}/getMe',
  },
  viber: {
    base: 'https://chatapi.viber.com',
    sendPath: '/pa/send_message',
    testPath: '/pa/get_account_info',
  },
} as const;

/**
 * Reads the token a chat provider authenticates with.
 *
 * @param context Credentials and configuration of the channel.
 * @returns The token, or an empty string when none is stored.
 */
function tokenOf(context: MessagingContext): string {
  return context.credentials.bot_token ?? context.credentials.api_key ?? '';
}

/**
 * Builds a full address for one call.
 *
 * @param context Credentials and configuration of the channel.
 * @param kind Which call is being made.
 * @returns The address to call.
 */
function endpointFor(context: MessagingContext, kind: 'send' | 'test'): string {
  const isViber = context.channel === 'viber';
  const defaults = isViber ? DEFAULTS.viber : DEFAULTS.telegram;
  const base = readSetting(context.settings, 'base_url', defaults.base);
  const path = readSetting(
    context.settings,
    kind === 'send' ? 'send_path' : 'test_path',
    kind === 'send' ? defaults.sendPath : defaults.testPath
  );

  return `${base.replace(/\/+$/, '')}${path.replace('{token}', tokenOf(context))}`;
}

/**
 * Builds the headers for one chat provider.
 *
 * @param context Credentials and configuration of the channel.
 * @returns The headers to send.
 */
function headersFor(context: MessagingContext): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
  };

  if (context.channel === 'viber') {
    headers['x-viber-auth-token'] = tokenOf(context);
  }

  return headers;
}

/**
 * Builds the body one chat provider expects.
 *
 * @param context Credentials and configuration of the channel.
 * @param message The message being sent.
 * @returns The body, ready to be serialised.
 */
function bodyFor(
  context: MessagingContext,
  message: OutboundChannelMessage
): Record<string, unknown> {
  if (context.channel === 'viber') {
    return {
      receiver: message.toAddress,
      type: 'text',
      text: message.bodyText,
      sender: { name: context.senderAddress ?? 'Billing' },
      tracking_data: message.reference,
    };
  }

  return {
    chat_id: message.toAddress,
    text: message.bodyText,
    disable_web_page_preview: true,
  };
}

export const chatBotAdapter: MessagingAdapter = {
  key: 'chat_bot',

  async testConnection(context: MessagingContext): Promise<ChannelTestResult> {
    if (!tokenOf(context)) {
      return {
        isHealthy: false,
        message: 'Add the bot token from the chat application before testing the channel.',
      };
    }

    try {
      const response = await callProvider(endpointFor(context, 'test'), {
        method: context.channel === 'viber' ? 'POST' : 'GET',
        headers: headersFor(context),
        ...(context.channel === 'viber' ? { body: '{}' } : {}),
      });

      if (!response.ok) {
        return {
          isHealthy: false,
          message: `The chat application refused the token with status ${response.status}.`,
        };
      }

      return { isHealthy: true, message: 'The chat application accepted the bot token.' };
    } catch (caught) {
      return { isHealthy: false, message: describeFailure(caught) };
    }
  },

  async send(
    context: MessagingContext,
    message: OutboundChannelMessage
  ): Promise<ChannelSendOutcome> {
    if (!tokenOf(context)) {
      return { status: 'not_configured', reason: 'This channel has no bot token yet.' };
    }

    try {
      const response = await callProvider(endpointFor(context, 'send'), {
        method: 'POST',
        headers: headersFor(context),
        body: JSON.stringify(bodyFor(context, message)),
      });

      const text = await response.text();

      if (!response.ok) {
        return {
          status: 'failed',
          reason: `The chat application refused the message with status ${response.status}.`,
          isPermanent: response.status >= 400 && response.status < 500,
        };
      }

      let providerMessageId: string | null = null;

      try {
        const parsed: unknown = JSON.parse(text);

        if (parsed !== null && typeof parsed === 'object') {
          const record = parsed as Record<string, unknown>;
          const result = record.result;

          if (result !== null && typeof result === 'object') {
            const inner = (result as Record<string, unknown>).message_id;

            providerMessageId = typeof inner === 'number' ? String(inner) : null;
          }

          if (providerMessageId === null && typeof record.message_token === 'number') {
            providerMessageId = String(record.message_token);
          }

          // A chat application can answer with a two hundred and still refuse
          // the message, so the body has the last word.
          if (record.ok === false || (typeof record.status === 'number' && record.status !== 0)) {
            return {
              status: 'failed',
              reason:
                typeof record.description === 'string'
                  ? record.description
                  : 'The chat application refused the message.',
              isPermanent: true,
            };
          }
        }
      } catch {
        logger.warn('A chat application answered with something other than data', {
          provider: context.provider,
        });
      }

      return { status: 'sent', providerMessageId };
    } catch (caught) {
      return { status: 'failed', reason: describeFailure(caught), isPermanent: false };
    }
  },
};
