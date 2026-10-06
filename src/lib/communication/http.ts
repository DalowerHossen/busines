import 'server-only';

export class CommunicationProviderError extends Error {
  readonly provider: string;
  readonly statusCode: number | null;
  readonly retryable: boolean;

  constructor(provider: string, statusCode: number | null, retryable: boolean) {
    super('Communication provider request failed.');
    this.name = 'CommunicationProviderError';
    this.provider = provider;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

interface RequestOptions {
  readonly provider: string;
  readonly url: string;
  readonly method: 'GET' | 'POST';
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: BodyInit;
  readonly timeoutMs: number;
}

async function executeRequest<T>(
  options: RequestOptions,
  parse: (responseText: string) => T
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch {
    throw new CommunicationProviderError(options.provider, null, true);
  }

  const responseText = await response.text();
  if (!response.ok) {
    throw new CommunicationProviderError(
      options.provider,
      response.status,
      response.status === 408 ||
        response.status === 409 ||
        response.status === 425 ||
        response.status === 429 ||
        response.status >= 500
    );
  }

  try {
    return parse(responseText);
  } catch {
    throw new CommunicationProviderError(options.provider, response.status, false);
  }
}

export async function requestJson<T>(options: {
  readonly provider: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Readonly<Record<string, unknown>>;
  readonly timeoutMs?: number;
}): Promise<T> {
  return executeRequest<T>(
    {
      provider: options.provider,
      url: options.url,
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(options.body),
      timeoutMs: options.timeoutMs ?? 10_000,
    },
    (text) => JSON.parse(text) as T
  );
}

export async function requestForm<T>(options: {
  readonly provider: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: URLSearchParams;
  readonly timeoutMs?: number;
}): Promise<T> {
  return executeRequest<T>(
    {
      provider: options.provider,
      url: options.url,
      method: 'POST',
      headers: { Accept: 'application/json', ...options.headers },
      body: options.body,
      timeoutMs: options.timeoutMs ?? 10_000,
    },
    (text) => JSON.parse(text) as T
  );
}

export function requireSecret(secret: string | undefined, provider: string): string {
  if (!secret) {
    throw new CommunicationProviderError(provider, null, false);
  }
  return secret;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function requiredString(value: unknown, provider: string): string {
  const result = stringValue(value);
  if (!result) {
    throw new CommunicationProviderError(provider, null, false);
  }
  return result;
}

export function normalizeRecipient(value: string, provider: string): string {
  const recipient = value.trim();
  if (recipient.length === 0 || recipient.length > 320) {
    throw new CommunicationProviderError(provider, null, false);
  }
  return recipient;
}
