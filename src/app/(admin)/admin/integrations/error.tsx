// src/app/(admin)/admin/integrations/error.tsx
// Shown when the connection console cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface AdminIntegrationsErrorProps {
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
export default function AdminIntegrationsError({ error, reset }: AdminIntegrationsErrorProps) {
  useEffect(() => {
    logger.error('The connection console failed to render', error, {
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <ErrorState
      title="The connections could not be opened"
      message="No key has been changed and nothing has stopped working. Try again, and check the logs if it keeps happening."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
