// src/components/loyalty/ask-for-review-button.tsx
// Asking the client of a paid invoice what they thought, from the invoice
// itself, where the thought actually occurs.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { notify } from '@/components/ui/toaster';
import { inviteInvoiceReview } from '@/features/loyalty/actions/invite-review';

export interface AskForReviewButtonProps {
  /** Invoice the client is being asked about. */
  invoiceId: string;
}

/**
 * Renders the invitation button.
 *
 * @param props The invoice being asked about.
 * @returns The rendered button.
 */
export function AskForReviewButton({ invoiceId }: AskForReviewButtonProps) {
  const router = useRouter();
  const [isWorking, setIsWorking] = useState(false);

  /**
   * Raises the invitation.
   *
   * @returns Nothing.
   */
  async function onAsk(): Promise<void> {
    setIsWorking(true);

    const result = await inviteInvoiceReview({ invoiceId });

    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success(
      result.data.requestId === null
        ? 'This client has already been asked about this invoice.'
        : 'The client has been invited to say what they thought.'
    );
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="secondary"
      isLoading={isWorking}
      loadingLabel="Asking"
      onClick={() => void onAsk()}
    >
      Ask for a review
    </Button>
  );
}
