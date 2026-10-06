// src/app/(admin)/admin/content/error.tsx
// Shown when the website editor cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface AdminContentErrorProps {
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
export default function AdminContentError({ error, reset }: AdminContentErrorProps) {
  useEffect(() => {
    logger.error('The website editor failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="The website editor could not be opened"
      message="The public site is unaffected and no page has changed. Try again in a moment."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
