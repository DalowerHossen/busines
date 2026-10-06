// src/app/(admin)/admin/tenants/[companyId]/error.tsx
// Shown when one business cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface AdminTenantErrorProps {
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
export default function AdminTenantError({ error, reset }: AdminTenantErrorProps) {
  useEffect(() => {
    logger.error('A business page failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="That business could not be opened"
      message="Nothing has been changed on it. Try again in a moment."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
