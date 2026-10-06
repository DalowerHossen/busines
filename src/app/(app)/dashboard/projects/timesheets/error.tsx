// src/app/(app)/dashboard/projects/timesheets/error.tsx
// Shown when the timesheet screen cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface TimesheetsErrorProps {
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
export default function TimesheetsError({ error, reset }: TimesheetsErrorProps) {
  useEffect(() => {
    logger.error('The timesheet screen failed to render', error, {
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <ErrorState
      title="This page could not be opened"
      message="No hours have been changed and nothing has been approved. Try again in a moment."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
