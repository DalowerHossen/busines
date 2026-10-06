// src/app/sign/[token]/error.tsx
// Shown when a signing invitation cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface SigningErrorProps {
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
export default function SigningError({ error, reset }: SigningErrorProps) {
  useEffect(() => {
    logger.error('A signing page failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="This agreement could not be opened"
      message="Nothing has been signed. Try the link again, and reply to the email you were sent if it keeps happening."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
