// src/app/(app)/dashboard/contracts/[contractId]/error.tsx
// Shown when one agreement cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface ContractErrorProps {
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
export default function ContractError({ error, reset }: ContractErrorProps) {
  useEffect(() => {
    logger.error('One agreement failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="This agreement could not be opened"
      message="Nothing has been lost. Try again, and write to support if it keeps happening."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
