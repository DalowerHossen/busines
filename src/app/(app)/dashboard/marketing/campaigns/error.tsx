// src/app/(app)/dashboard/marketing/campaigns/error.tsx
// Shown when the campaign screen cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface CampaignsErrorProps {
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
export default function CampaignsError({ error, reset }: CampaignsErrorProps) {
  useEffect(() => {
    logger.error('The campaign screen failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="This page could not be opened"
      message="No campaign has been sent or changed. Try again in a moment."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
