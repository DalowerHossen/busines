// src/app/(admin)/admin/tenants/error.tsx
// Shown when the business list cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface AdminTenantsErrorProps {
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
export default function AdminTenantsError({ error, reset }: AdminTenantsErrorProps) {
  useEffect(() => {
    logger.error('The business list failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="The business list could not be opened"
      message="No business has been changed. Try again in a moment."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
