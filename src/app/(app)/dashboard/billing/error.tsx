// src/app/(app)/dashboard/billing/error.tsx
// Shown when the billing page cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface BillingErrorProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the page again. */
  reset: () => void;
}

/**
 * Renders the failure state.
 *
 * @param props The error and the retry function.
 * @returns The rendered state.
 */
export default function BillingError({ error, reset }: BillingErrorProps) {
  useEffect(() => {
    logger.error('The billing page failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="Your plan could not be opened"
      message="Nothing has been changed on your account. Try again, and write to support if it keeps happening."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
