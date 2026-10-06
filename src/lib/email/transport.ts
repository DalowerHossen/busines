// src/lib/email/transport.ts
// Handing a message to the email provider. The platform speaks to Resend over
// its REST interface, so no provider library has to be kept up to date, and a
// different provider can be added beside this one without touching callers.

import 'server-only';

import { serverEnv } from '@/lib/env/env.server';
import { logger } from '@/lib/logger';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export interface OutboundEmail {
  fromName: string | null;
  fromEmail: string;
  replyToEmail: string | null;
  toEmail: string;
  toName: string | null;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
}

export type EmailSendOutcome =
  | { status: 'sent'; providerMessageId: string | null }
  | { status: 'failed'; reason: string; isPermanent: boolean }
  | { status: 'not_configured'; reason: string };

/**
 * Formats an address the way a mail header expects it.
 *
 * @param name Display name, when one is known.
 * @param email Address itself.
 * @returns The formatted address.
 */
function formatAddress(name: string | null, email: string): string {
  if (!name || name.trim().length === 0) {
    return email;
  }

  return `${name.replace(/["<>]/g, '').trim()} <${email}>`;
}

/**
 * Sends one email through the configured provider.
 *
 * @param email The message to deliver.
 * @returns What the provider did with it.
 */
export async function sendEmail(email: OutboundEmail): Promise<EmailSendOutcome> {
  const apiKey = serverEnv.RESEND_API_KEY;

  if (!apiKey) {
    return {
      status: 'not_configured',
      reason: 'No email provider key is configured yet, so the message stays in the queue.',
    };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: formatAddress(email.fromName, email.fromEmail),
        to: [formatAddress(email.toName, email.toEmail)],
        reply_to: email.replyToEmail ?? undefined,
        subject: email.subject,
        html: email.bodyHtml ?? undefined,
        text: email.bodyText ?? undefined,
      }),
    });

    if (response.ok) {
      const payload: unknown = await response.json();
      const id =
        typeof payload === 'object' && payload !== null && 'id' in payload
          ? String((payload as { id: unknown }).id)
          : null;

      return { status: 'sent', providerMessageId: id };
    }

    const detail = await response.text();

    return {
      status: 'failed',
      reason: `The provider refused the message with status ${response.status}: ${detail.slice(0, 300)}`,
      isPermanent: response.status >= 400 && response.status < 500 && response.status !== 429,
    };
  } catch (caught) {
    logger.error('The email provider could not be reached', caught, { toEmail: email.toEmail });

    return {
      status: 'failed',
      reason: 'The email provider could not be reached.',
      isPermanent: false,
    };
  }
}
