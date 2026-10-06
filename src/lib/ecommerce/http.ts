import 'server-only';

import { EcommerceProviderError, retryableStatus } from './errors';
import type { EcommerceFetch, ProviderHttpResponse } from './types';

export interface EcommerceRequestOptions {
  readonly provider: string;
  readonly url: string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly headers?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, string | number | boolean | null | undefined>>;
  readonly body?: unknown;
  readonly fetchImpl?: EcommerceFetch;
  readonly timeoutMs?: number;
}

export function buildUrl(
  baseUrl: string,
  query?: Readonly<Record<string, string | number | boolean | null | undefined>>
): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function requireHttpsUrl(value: string, provider: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new EcommerceProviderError(provider, 'invalid_configuration', null, false);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new EcommerceProviderError(provider, 'invalid_configuration', null, false);
  }
  return url;
}

export async function requestJson<T>(
  options: EcommerceRequestOptions
): Promise<ProviderHttpResponse<T>> {
  const url = buildUrl(options.url, options.query);
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: options.method,
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    });
  } catch {
    throw new EcommerceProviderError(options.provider, 'provider_request_failed', null, true);
  }

  const responseText = await response.text();
  if (!response.ok) {
    throw new EcommerceProviderError(
      options.provider,
      'provider_request_failed',
      response.status,
      retryableStatus(response.status)
    );
  }

  let data: T;
  try {
    data = JSON.parse(responseText) as T;
  } catch {
    throw new EcommerceProviderError(options.provider, 'invalid_response', response.status, false);
  }

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return { data, status: response.status, headers };
}

export function basicAuthHeader(username: string, password: string, provider: string): string {
  if (!username || !password) {
    throw new EcommerceProviderError(provider, 'invalid_configuration', null, false);
  }
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function requiredString(value: unknown, provider: string): string {
  const result = stringValue(value);
  if (!result) {
    throw new EcommerceProviderError(provider, 'invalid_response', null, false);
  }
  return result;
}
