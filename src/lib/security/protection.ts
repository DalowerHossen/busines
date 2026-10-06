import 'server-only';

import { assessBotRequest, headerValue } from './bot-detection';
import { SecurityProviderError } from './errors';
import { assessHoneypot } from './honeypot';
import { enforceRateLimit } from './rate-limit';
import type {
  BotAssessment,
  RequestProtectionDecision,
  RequestProtectionInput,
  RateLimitResult,
  SecurityObservationType,
  TurnstileValidationResult,
} from './types';

export async function protectRequest(
  input: RequestProtectionInput
): Promise<RequestProtectionDecision> {
  const bot = assessBotRequest(input.request, input.routeClass);
  if (bot.action === 'block') {
    return deny(input, bot, null, 403, 'bot', 'bot-blocked');
  }

  let rateLimit: RateLimitResult | null = null;
  if (input.rateLimitStore && input.rateLimitPolicy) {
    try {
      rateLimit = await enforceRateLimit({
        store: input.rateLimitStore,
        policy: input.rateLimitPolicy,
        key: {
          pathname: input.request.pathname,
          method: input.request.method,
          ipAddress: input.request.ipAddress,
          accountIdentifier: input.request.accountIdentifier,
          userAgent: headerValue(input.request.headers, 'user-agent'),
          requestFingerprint: headerValue(input.request.headers, 'x-request-fingerprint'),
        },
      });
    } catch (error) {
      if (input.rateLimitPolicy.failOpen && isRetryableRateLimitStoreError(error)) {
        rateLimit = null;
      } else {
        return deny(input, bot, null, 503, 'rate-limit-unavailable', 'rate-limit-unavailable');
      }
    }
    if (rateLimit && !rateLimit.allowed) {
      return deny(input, bot, rateLimit, 429, 'rate-limit', 'rate-limit-blocked');
    }
  }

  if (input.honeypot && assessHoneypot(input.honeypot).tripped) {
    return deny(input, bot, rateLimit, 400, 'honeypot', 'honeypot-tripped');
  }

  if (
    bot.action === 'challenge' ||
    input.routeClass === 'sensitive' ||
    input.routeClass === 'auth'
  ) {
    if (!input.turnstile || !input.turnstileToken) {
      return deny(input, bot, rateLimit, 403, 'turnstile', 'turnstile-challenge-failed');
    }
    let validation: TurnstileValidationResult;
    try {
      validation = await input.turnstile.validate({ token: input.turnstileToken });
    } catch (error) {
      if (error instanceof SecurityProviderError && error.retryable) {
        return deny(
          input,
          bot,
          rateLimit,
          503,
          'turnstile-unavailable',
          'turnstile-challenge-failed'
        );
      }
      return deny(input, bot, rateLimit, 403, 'turnstile', 'turnstile-challenge-failed');
    }
    if (
      !validation.valid ||
      (input.expectedTurnstileAction !== undefined &&
        validation.action !== input.expectedTurnstileAction)
    ) {
      return deny(input, bot, rateLimit, 403, 'turnstile', 'turnstile-challenge-failed');
    }
    await observe(input, bot, 'turnstile-challenge-passed');
  }

  return { allowed: true, statusCode: 200, reason: 'allowed', bot, rateLimit };
}

async function deny(
  input: RequestProtectionInput,
  bot: BotAssessment,
  rateLimit: RateLimitResult | null,
  statusCode: 400 | 403 | 429 | 503,
  reason: RequestProtectionDecision['reason'],
  observationType: SecurityObservationType
): Promise<RequestProtectionDecision> {
  await observe(input, bot, observationType);
  return { allowed: false, statusCode, reason, bot, rateLimit };
}

async function observe(
  input: RequestProtectionInput,
  bot: BotAssessment,
  type: SecurityObservationType
): Promise<void> {
  if (!input.observationSink) return;
  try {
    await input.observationSink.record({
      type,
      pathname: input.request.pathname,
      routeClass: input.routeClass,
      category: bot.category,
      occurredAt: new Date().toISOString(),
    });
  } catch {
    // Monitoring failure must not turn a protection decision into an outage.
  }
}

function isRetryableRateLimitStoreError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'retryable' in error &&
    (error as { readonly retryable?: unknown }).retryable === true
  );
}
