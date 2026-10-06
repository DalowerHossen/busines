// src/components/accountant/visit-recorder.tsx
// Records, once per page view, that an accountant opened a set of books.
// The owner sees the stamp on their side, which is why the component exists
// rather than the visit being recorded silently.

'use client';

import { useEffect, useRef } from 'react';

import { recordWorkspaceVisit } from '@/features/accountants/actions/record-visit';
import { logger } from '@/lib/logger';

export interface VisitRecorderProps {
  /** Business whose books are being opened. */
  companyId: string;
}

/**
 * Records the visit and renders nothing.
 *
 * @param props The business being opened.
 * @returns Nothing visible.
 */
export function VisitRecorder({ companyId }: VisitRecorderProps) {
  const hasRecorded = useRef(false);

  useEffect(() => {
    if (hasRecorded.current) {
      return;
    }

    hasRecorded.current = true;

    void recordWorkspaceVisit({ companyId }).then((result) => {
      if (!result.success) {
        logger.warn('The bookkeeping visit was not recorded', {
          companyId,
          reason: result.error,
        });
      }
    });
  }, [companyId]);

  return null;
}
