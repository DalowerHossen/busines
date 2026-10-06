import 'server-only';

export class EmailProviderError extends Error {
  readonly provider: 'resend_api' | 'resend_smtp';
  readonly statusCode: number | null;
  readonly retryable: boolean;

  constructor(
    provider: 'resend_api' | 'resend_smtp',
    statusCode: number | null,
    retryable: boolean
  ) {
    super('Email provider request failed.');
    this.name = 'EmailProviderError';
    this.provider = provider;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export async function requestResendJson<T>(input: {
  readonly apiKey: string;
  readonly url: string;
  readonly body: Readonly<Record<string, unknown>>;
  readonly timeoutMs: number;
}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input.url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify(input.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(input.timeoutMs),
    });
  } catch {
    throw new EmailProviderError('resend_api', null, true);
  }

  const responseText = await response.text();
  if (!response.ok) {
    throw new EmailProviderError(
      'resend_api',
      response.status,
      response.status === 408 ||
        response.status === 409 ||
        response.status === 425 ||
        response.status === 429 ||
        response.status >= 500
    );
  }
  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new EmailProviderError('resend_api', response.status, false);
  }
}

export function requireEmailSecret(
  secret: string | undefined,
  provider: 'resend_api' | 'resend_smtp'
): string {
  if (!secret || secret.trim().length === 0) {
    throw new EmailProviderError(provider, null, false);
  }
  return secret;
}
