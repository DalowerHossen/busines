// src/app/(app)/dashboard/settings/integrations/error.tsx
// Shown when the connections page cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface IntegrationSettingsErrorProps {
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
export default function IntegrationSettingsError({ error, reset }: IntegrationSettingsErrorProps) {
  useEffect(() => {
    logger.error('The connections page failed to render', error, {
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <ErrorState
      title="This page could not be opened"
      message="None of your keys have changed and nothing has stopped working. Try again in a moment."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
