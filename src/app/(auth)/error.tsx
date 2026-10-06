// src/app/(auth)/error.tsx
// Shown when a page in this section fails. The visitor keeps the surrounding
// layout and can retry without losing where they were.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface AuthErrorProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the page again. */
  reset: () => void;
}

/**
 * Renders the failure state for this section.
 *
 * @param props The error and the retry function.
 * @returns The rendered state.
 */
export default function AuthError({ error, reset }: AuthErrorProps) {
  useEffect(() => {
    logger.error('A page failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="This page could not be loaded"
      message="Your account is safe. Something went wrong while preparing this step of signing in."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
