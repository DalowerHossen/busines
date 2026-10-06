// src/lib/messaging/providers/configurable.ts
// The way in for a supplier nobody has written code for. Everything the
// platform needs to know about it is stored with the channel: an address, a
// header to authenticate with, and the names of three fields. That is enough
// for most of the market, and it means a new supplier takes a form rather
// than a release.

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

/**
 * Builds the headers from what was configured.
 *
 * @param context Credentials and configuration of the channel.
 * @returns The headers to send.
 */
function headersFor(context: MessagingContext): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
  };

  const token = context.credentials.api_key ?? '';
  const headerName = readSetting(context.settings, 'auth_header', 'authorization');
  const prefix = readSetting(context.settings, 'auth_prefix', 'Bearer ');

  if (token) {
    headers[headerName.toLowerCase()] = `${prefix}${token}`.trim();
  }

  return headers;
}

export const configurableMessagingAdapter: MessagingAdapter = {
  key: 'configurable',

  async testConnection(context: MessagingContext): Promise<ChannelTestResult> {
    const endpoint = readSetting(context.settings, 'status_url', '');

    if (!endpoint) {
      return {
        isHealthy: false,
        message:
          'Add the address this supplier publishes for checking an account, and the channel can be tested like any other.',
      };
    }

    try {
      const response = await callProvider(endpoint, {
        method: readSetting(context.settings, 'status_method', 'GET'),
        headers: headersFor(context),
      });

      return response.ok
        ? { isHealthy: true, message: 'The supplier accepted the credentials.' }
        : {
            isHealthy: false,
            message: `The supplier answered with status ${response.status}.`,
          };
    } catch (caught) {
      return { isHealthy: false, message: describeFailure(caught) };
    }
  },

  async send(
    context: MessagingContext,
    message: OutboundChannelMessage
  ): Promise<ChannelSendOutcome> {
    const endpoint = readSetting(context.settings, 'send_url', '');

    if (!endpoint) {
      return {
        status: 'not_configured',
        reason: 'This channel has no sending address configured yet.',
      };
    }

    const payload: Record<string, unknown> = {
      [readSetting(context.settings, 'to_field', 'to')]: message.toAddress,
      [readSetting(context.settings, 'body_field', 'text')]: message.bodyText,
      [readSetting(context.settings, 'reference_field', 'reference')]: message.reference,
    };

    if (context.senderAddress) {
      payload[readSetting(context.settings, 'from_field', 'from')] = context.senderAddress;
    }

    try {
      const response = await callProvider(endpoint, {
        method: 'POST',
        headers: headersFor(context),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return {
          status: 'failed',
          reason: `The supplier refused the message with status ${response.status}.`,
          isPermanent: response.status >= 400 && response.status < 500,
        };
      }

      return { status: 'sent', providerMessageId: null };
    } catch (caught) {
      return { status: 'failed', reason: describeFailure(caught), isPermanent: false };
    }
  },
};
