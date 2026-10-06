// tests/unit/observability.test.ts
// Reporting a failure must never be able to cause one, and must never
// carry a secret to a third party.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { reportFailure } from '@/lib/observability/report';

const ORIGINAL_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

describe('reporting a failure', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (ORIGINAL_DSN === undefined) {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    } else {
      process.env.NEXT_PUBLIC_SENTRY_DSN = ORIGINAL_DSN;
    }
  });

  it('sends nothing at all when no reporting service is configured', () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    const sent = vi.fn();
    vi.stubGlobal('fetch', sent);

    reportFailure('Something went wrong', new Error('Boom'));

    expect(sent).not.toHaveBeenCalled();
  });

  it('posts an envelope when one is configured', () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://abc123@o1.ingest.example.com/42';

    const sent = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', sent);

    reportFailure('Payment settlement failed', new Error('Boom'), { companyId: 'c-1' });

    expect(sent).toHaveBeenCalledTimes(1);
    expect(String(sent.mock.calls[0]?.[0])).toContain('/api/42/envelope/');
  });

  it('never carries anything that looks like a secret', () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://abc123@o1.ingest.example.com/42';

    const sent = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', sent);

    reportFailure('A provider refused us', new Error('Boom'), {
      apiKey: 'sk_live_must_never_leave',
      companyId: 'c-1',
    });

    const body = String((sent.mock.calls[0]?.[1] as { body: string }).body);

    expect(body).not.toContain('sk_live_must_never_leave');
    expect(body).toContain('[redacted]');
  });

  it('swallows a reporting service that is itself broken', () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://abc123@o1.ingest.example.com/42';

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('The reporting service is down')));

    expect(() => {
      reportFailure('Something went wrong', new Error('Boom'));
    }).not.toThrow();
  });

  it('ignores a connection string that is not one', () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'not-a-dsn';

    const sent = vi.fn();
    vi.stubGlobal('fetch', sent);

    reportFailure('Something went wrong');

    expect(sent).not.toHaveBeenCalled();
  });
});
