// src/app/(admin)/admin/money/error.tsx
// Shown when the money queue cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface AdminMoneyErrorProps {
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
export default function AdminMoneyError({ error, reset }: AdminMoneyErrorProps) {
  useEffect(() => {
    logger.error('The money queue failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="The money queue could not be opened"
      message="No payout has been released or refused. Try again in a moment."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
