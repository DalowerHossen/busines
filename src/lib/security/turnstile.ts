import 'server-only';

import {
  SecurityProviderError,
  securityInvalidConfiguration,
  securityInvalidProviderResponse,
  securityInvalidRequest,
  securityRetryableStatus,
} from './errors';
import type {
  SecurityFetch,
  TurnstileValidationInput,
  TurnstileValidationResult,
  TurnstileValidator,
} from './types';

const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileConfig {
  readonly secretKey: string;
  readonly expectedAction?: string;
  readonly expectedHostname?: string;
  readonly fetchImpl?: SecurityFetch;
  readonly timeoutMs?: number;
}

interface TurnstileResponse {
  readonly success?: boolean;
  readonly challenge_ts?: string;
  readonly hostname?: string;
  readonly action?: string;
  readonly ['error-codes']?: readonly string[];
}

export class CloudflareTurnstileValidator implements TurnstileValidator {
  private readonly config: {
    readonly secretKey: string;
    readonly expectedAction?: string;
    readonly expectedHostname?: string;
    readonly fetchImpl?: SecurityFetch;
    readonly timeoutMs: number;
  };

  constructor(config: TurnstileConfig) {
    if (!config.secretKey) throw securityInvalidConfiguration();
    this.config = {
      secretKey: config.secretKey,
      expectedAction: config.expectedAction,
      expectedHostname: config.expectedHostname,
      fetchImpl: config.fetchImpl,
      timeoutMs: config.timeoutMs ?? 10_000,
    };
  }

  async validate(input: TurnstileValidationInput): Promise<TurnstileValidationResult> {
    validateInput(input);
    const form = new FormData();
    form.set('secret', this.config.secretKey);
    form.set('response', input.token);
    if (input.remoteIp) form.set('remoteip', input.remoteIp);
    if (input.idempotencyKey) form.set('idempotency_key', input.idempotencyKey);

    let response: Response;
    try {
      response = await (this.config.fetchImpl ?? fetch)(TURNSTILE_SITEVERIFY_URL, {
        method: 'POST',
        body: form,
        cache: 'no-store',
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch {
      throw new SecurityProviderError(
        'cloudflare-turnstile',
        'provider_request_failed',
        null,
        true
      );
    }

    if (!response.ok) {
      throw new SecurityProviderError(
        'cloudflare-turnstile',
        'provider_request_failed',
        response.status,
        securityRetryableStatus(response.status)
      );
    }

    let result: TurnstileResponse;
    try {
      result = (await response.json()) as TurnstileResponse;
    } catch {
      throw securityInvalidProviderResponse('cloudflare-turnstile', response.status);
    }
    if (typeof result !== 'object' || result === null || typeof result.success !== 'boolean') {
      throw securityInvalidProviderResponse('cloudflare-turnstile', response.status);
    }

    const errorCodes = Array.isArray(result['error-codes'])
      ? result['error-codes']
          .filter((code): code is string => typeof code === 'string')
          .slice(0, 10)
      : [];
    const actionMatches =
      this.config.expectedAction === undefined || result.action === this.config.expectedAction;
    const hostnameMatches =
      this.config.expectedHostname === undefined ||
      result.hostname === this.config.expectedHostname;
    return {
      valid: result.success && actionMatches && hostnameMatches,
      action: typeof result.action === 'string' ? result.action : null,
      hostname: typeof result.hostname === 'string' ? result.hostname : null,
      challengeTimestamp: typeof result.challenge_ts === 'string' ? result.challenge_ts : null,
      errorCodes: result.success && actionMatches && hostnameMatches ? [] : errorCodes,
    };
  }
}

function validateInput(input: TurnstileValidationInput): void {
  if (!input.token || input.token.length > 2048) throw securityInvalidRequest();
  if (input.remoteIp && input.remoteIp.length > 255) throw securityInvalidRequest();
  if (input.idempotencyKey && !isUuid(input.idempotencyKey)) throw securityInvalidRequest();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

export { TURNSTILE_SITEVERIFY_URL };
