// src/app/(admin)/admin/partners/error.tsx
// Shown when the white label console cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface AdminPartnersErrorProps {
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
export default function AdminPartnersError({ error, reset }: AdminPartnersErrorProps) {
  useEffect(() => {
    logger.error('The white label console failed to render', error, {
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <ErrorState
      title="This page could not be opened"
      message="No decision has been recorded. Try again, and raise it with engineering if it persists."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
