// src/features/marketing/actions/submit-contact-message.ts
// Receives a message from the contact page. The form is open to the world, so
// the submission is rate limited by address, checked for the hidden field a
// robot fills in, and stored in the platform inbox rather than emailed blindly.

'use server';

import { BRAND } from '@/config/brand';
import { contactMessageSchema } from '@/features/marketing/validation/contact';
import { createAction } from '@/lib/actions/create-action';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { anonymousBucketKey, consumeRateLimit } from '@/lib/security/rate-limit';
import { getRequestContext } from '@/lib/security/request-context';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

/** Messages accepted from one address in one hour. */
const HOURLY_LIMIT = 5;

export interface SubmitContactMessageResult {
  /** Reference shown to the sender so a follow up can be matched. */
  reference: string;
}

/**
 * Builds the readable body stored against the message.
 *
 * @param input Validated form values.
 * @returns The text written into the inbox entry.
 */
function composeBody(input: {
  fullName: string;
  companyName: string | null;
  topic: string;
  message: string;
}): string {
  const lines = [
    `Name: ${input.fullName}`,
    `Company: ${input.companyName ?? 'Not given'}`,
    `Topic: ${input.topic}`,
    '',
    input.message,
  ];

  return lines.join('\n');
}

export const submitContactMessage = createAction(
  contactMessageSchema,
  async (input): Promise<SubmitContactMessageResult> => {
    const context = getRequestContext();

    const decision = await consumeRateLimit({
      kind: 'contact_form',
      key: anonymousBucketKey('contact', context.ipHash),
      limit: HOURLY_LIMIT,
      windowSeconds: 3600,
    });

    if (!decision.isAllowed) {
      throw new AppError(
        'rate_limited',
        'We have already received several messages from here. Please try again in an hour.'
      );
    }

    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase
      .from('inbound_messages')
      .insert({
        company_id: null,
        channel: 'email',
        from_address: input.email,
        to_address: BRAND.supportEmail,
        body_text: composeBody(input),
        provider: 'website_contact_form',
        attachments: [],
      })
      .select('id')
      .single();

    if (error) {
      logger.error('A contact message could not be stored', error, {
        action: 'submitContactMessage',
      });

      throw new AppError(
        'database_failure',
        `The message could not be sent. Please write to ${BRAND.supportEmail} instead.`
      );
    }

    const reference = typeof data.id === 'string' ? data.id.slice(0, 8).toUpperCase() : 'RECEIVED';

    logger.info('A contact message was received', {
      action: 'submitContactMessage',
      topic: input.topic,
      reference,
    });

    return { reference };
  },
  { name: 'submitContactMessage' }
);
