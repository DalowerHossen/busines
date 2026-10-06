// src/lib/messaging/providers/text-message.ts
// Text messages, sent through whichever supplier a business has an account
// with. Suppliers in this space all accept a form encoded post with a sender,
// a recipient and a body, so the differences between them are expressed as
// settings rather than as code.

import 'server-only';

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
import { logger } from '@/lib/logger';

/**
 * Builds the headers one supplier expects.
 *
 * @param context Credentials and configuration of the channel.
 * @returns The headers to send.
 */
function buildHeaders(context: MessagingContext): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
    accept: 'application/json',
  };

  const token = context.credentials.api_key ?? context.credentials.auth_token ?? '';
  const accountId = context.credentials.account_id ?? '';
  const scheme = readSetting(context.settings, 'auth_scheme', accountId ? 'basic' : 'bearer');

  if (scheme === 'basic' && accountId && token) {
    headers.authorization = `Basic ${Buffer.from(`${accountId}:${token}`).toString('base64')}`;
  } else if (token) {
    const headerName = readSetting(context.settings, 'auth_header', 'authorization');

    headers[headerName] = headerName === 'authorization' ? `Bearer ${token}` : token;
  }

  return headers;
}

/**
 * Builds the body one supplier expects, using the field names it uses.
 *
 * @param context Credentials and configuration of the channel.
 * @param message The message being sent.
 * @returns The encoded body.
 */
function buildBody(context: MessagingContext, message: OutboundChannelMessage): URLSearchParams {
  const body = new URLSearchParams();

  body.set(readSetting(context.settings, 'to_field', 'To'), message.toAddress);
  body.set(readSetting(context.settings, 'body_field', 'Body'), message.bodyText);

  if (context.senderAddress) {
    body.set(readSetting(context.settings, 'from_field', 'From'), context.senderAddress);
  }

  const reference = readSetting(context.settings, 'reference_field', '');

  if (reference) {
    body.set(reference, message.reference);
  }

  return body;
}

export const textMessageAdapter: MessagingAdapter = {
  key: 'text_message',

  async testConnection(context: MessagingContext): Promise<ChannelTestResult> {
    const endpoint = readSetting(context.settings, 'status_url', '');

    if (!context.credentials.api_key && !context.credentials.auth_token) {
      return {
        isHealthy: false,
        message: 'Add the key your supplier gave you before testing the channel.',
      };
    }

    if (!endpoint) {
      return {
        isHealthy: false,
        message:
          'Add the address your supplier publishes for checking an account, so the channel can be tested before it is used.',
      };
    }

    try {
      const response = await callProvider(endpoint, {
        method: 'GET',
        headers: buildHeaders(context),
      });

      if (!response.ok) {
        return {
          isHealthy: false,
          message: `The supplier refused the credentials with status ${response.status}.`,
        };
      }

      return { isHealthy: true, message: 'The supplier accepted the credentials.' };
    } catch (caught) {
      return { isHealthy: false, message: describeFailure(caught) };
    }
  },

  async send(
    context: MessagingContext,
    message: OutboundChannelMessage
  ): Promise<ChannelSendOutcome> {
    const endpoint = readSetting(context.settings, 'send_url', '');

    if (!endpoint || (!context.credentials.api_key && !context.credentials.auth_token)) {
      return {
        status: 'not_configured',
        reason: 'This channel has no supplier address or key yet.',
      };
    }

    try {
      const response = await callProvider(endpoint, {
        method: 'POST',
        headers: buildHeaders(context),
        body: buildBody(context, message).toString(),
      });

      const text = await response.text();

      if (!response.ok) {
        // A refusal in the four hundreds is about the message itself and will
        // never succeed on a retry; anything else is worth trying again.
        return {
          status: 'failed',
          reason: `The supplier refused the message with status ${response.status}.`,
          isPermanent: response.status >= 400 && response.status < 500,
        };
      }

      let providerMessageId: string | null = null;

      try {
        const parsed: unknown = JSON.parse(text);

        if (parsed !== null && typeof parsed === 'object') {
          const record = parsed as Record<string, unknown>;
          const idField = readSetting(context.settings, 'id_field', 'sid');
          const value = record[idField];

          providerMessageId = typeof value === 'string' ? value : null;
        }
      } catch {
        logger.warn('A text message supplier answered with something other than data', {
          provider: context.provider,
        });
      }

      return { status: 'sent', providerMessageId };
    } catch (caught) {
      return { status: 'failed', reason: describeFailure(caught), isPermanent: false };
    }
  },
};
