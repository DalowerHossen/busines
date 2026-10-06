import 'server-only';

import { EmailProviderError } from './http';
import { renderEmailTemplate } from './template';
import type {
  EmailAdapter,
  EmailFailureLogger,
  EmailTemplateDefinition,
  EmailTemplateVariables,
  PlatformMailResult,
  SendEmailRequest,
} from './types';

const NOOP_FAILURE_LOGGER: EmailFailureLogger = {
  async recordFailure(): Promise<void> {
    return undefined;
  },
};

function failureResult(
  code: PlatformMailResult['failureCode'],
  retryable: boolean
): PlatformMailResult {
  return { sent: false, providerMessageId: null, failureCode: code, retryable };
}

export async function sendPlatformMail(input: {
  readonly adapter: EmailAdapter;
  readonly request: SendEmailRequest;
  readonly failureLogger?: EmailFailureLogger;
}): Promise<PlatformMailResult> {
  try {
    const result = await input.adapter.sendEmail(input.request);
    return {
      sent: true,
      providerMessageId: result.providerMessageId,
      failureCode: null,
      retryable: false,
    };
  } catch (error) {
    const retryable = error instanceof EmailProviderError ? error.retryable : false;
    const failureCode =
      error instanceof EmailProviderError && error.statusCode === null && !error.retryable
        ? 'configuration_invalid'
        : error instanceof EmailProviderError
          ? 'provider_request_failed'
          : 'configuration_invalid';
    const logger = input.failureLogger ?? NOOP_FAILURE_LOGGER;
    try {
      await logger.recordFailure({
        provider: input.adapter.provider,
        retryable,
        code: failureCode,
      });
    } catch {
      // Mail failure must never make the calling business action fail.
    }
    return failureResult(failureCode, retryable);
  }
}

export async function sendTemplatedPlatformMail(input: {
  readonly adapter: EmailAdapter;
  readonly recipientAddresses: readonly string[];
  readonly from?: string;
  readonly replyTo?: string;
  readonly template: EmailTemplateDefinition;
  readonly variables: EmailTemplateVariables;
  readonly idempotencyKey: string;
  readonly failureLogger?: EmailFailureLogger;
}): Promise<PlatformMailResult> {
  try {
    const rendered = renderEmailTemplate(input.template, input.variables);
    return await sendPlatformMail({
      adapter: input.adapter,
      failureLogger: input.failureLogger,
      request: {
        to: input.recipientAddresses,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        from: input.from,
        replyTo: input.replyTo,
        idempotencyKey: input.idempotencyKey,
      },
    });
  } catch {
    const logger = input.failureLogger ?? NOOP_FAILURE_LOGGER;
    try {
      await logger.recordFailure({
        provider: input.adapter.provider,
        retryable: false,
        code: 'template_invalid',
      });
    } catch {
      // Mail failure must never make the calling business action fail.
    }
    return failureResult('template_invalid', false);
  }
}
