// src/app/(app)/dashboard/settings/webhooks/error.tsx
// Shown when the webhook screen cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface WebhookSettingsErrorProps {
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
export default function WebhookSettingsError({ error, reset }: WebhookSettingsErrorProps) {
  useEffect(() => {
    logger.error('The webhook screen failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="This page could not be opened"
      message="Your endpoints are unchanged and events are still being delivered. Try again in a moment."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
