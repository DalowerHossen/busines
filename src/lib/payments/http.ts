// src/lib/payments/http.ts
// Minimal server-side HTTP helpers. Error bodies are never copied into thrown
// messages because payment providers can echo secrets, tokens, or personal
// data in failure responses.

import 'server-only';
export class PaymentProviderError extends Error {
  readonly provider: string;
  readonly statusCode: number | null;
  readonly retryable: boolean;

  constructor(provider: string, statusCode: number | null, retryable: boolean) {
    super('Payment provider request failed.');
    this.name = 'PaymentProviderError';
    this.provider = provider;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

interface RequestOptions {
  readonly provider: string;
  readonly url: string;
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: BodyInit;
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
    });
  } catch {
    throw new PaymentProviderError(options.provider, null, true);
  }

  const responseText = await response.text();
  if (!response.ok) {
    throw new PaymentProviderError(
      options.provider,
      response.status,
      response.status === 408 || response.status === 409 || response.status >= 500
    );
  }

  try {
    return parse(responseText);
  } catch (error) {
    if (error instanceof PaymentProviderError) throw error;
    throw new PaymentProviderError(options.provider, response.status, false);
  }
}

export async function requestJson<T>(options: {
  readonly provider: string;
  readonly url: string;
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: Readonly<Record<string, unknown>>;
}): Promise<T> {
  return executeRequest<T>(
    {
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    },
    (responseText) => JSON.parse(responseText) as T
  );
}

export async function requestForm<T>(options: {
  readonly provider: string;
  readonly url: string;
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly headers: Readonly<Record<string, string>>;
  readonly body: URLSearchParams;
}): Promise<T> {
  return executeRequest<T>(
    { ...options, body: options.body },
    (responseText) => JSON.parse(responseText) as T
  );
}

export async function requestFormValues<T>(options: {
  readonly provider: string;
  readonly url: string;
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly headers: Readonly<Record<string, string>>;
  readonly body: URLSearchParams;
}): Promise<T> {
  return executeRequest<T>(
    { ...options, body: options.body },
    (responseText) => Object.fromEntries(new URLSearchParams(responseText).entries()) as T
  );
}

export function jsonHeaders(extra: Readonly<Record<string, string>> = {}): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...extra,
  };
}

export function requireSecret(secret: string | undefined, provider: string): string {
  if (!secret) {
    throw new PaymentProviderError(provider, null, false);
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

export function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function requiredString(value: unknown, provider: string): string {
  const result = stringValue(value);
  if (!result) {
    throw new PaymentProviderError(provider, null, false);
  }
  return result;
}
