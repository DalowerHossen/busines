// src/app/(admin)/admin/affiliates/error.tsx
// Shown when the referral programme console cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface AdminAffiliatesErrorProps {
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
export default function AdminAffiliatesError({ error, reset }: AdminAffiliatesErrorProps) {
  useEffect(() => {
    logger.error('The referral console failed to render', error, {
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
