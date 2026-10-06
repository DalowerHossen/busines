// src/app/(admin)/admin/storage/error.tsx
// Shown when the storage console cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface AdminStorageErrorProps {
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
export default function AdminStorageError({ error, reset }: AdminStorageErrorProps) {
  useEffect(() => {
    logger.error('The storage console failed to render', error, {
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <ErrorState
      title="This page could not be opened"
      message="The stores themselves are untouched and uploads are unaffected. Try again, and check the platform logs if it keeps happening."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
