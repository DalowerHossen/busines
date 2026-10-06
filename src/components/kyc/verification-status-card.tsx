// src/components/kyc/verification-status-card.tsx
// Where the identity check stands, and the one button that sends it to us.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import { submitVerification } from '@/features/kyc/actions/submit-verification';
import type { KycVerification } from '@/features/kyc/types';
import { formatDate } from '@/lib/dates';

export interface VerificationStatusCardProps {
  /** The check, or null when the business has not started one. */
  verification: KycVerification | null;
}

/** What each state means in plain words. */
const EXPLANATIONS: Record<string, string> = {
  not_started: 'Fill in the answers below and upload your papers to begin.',
  in_progress: 'Your answers are saved. Send them to us when the papers are all in.',
  submitted: 'We have your check. Most are looked at within two working days.',
  under_review: 'A member of our team is reading your papers now.',
  verified: 'You are verified. Card payments settle to your wallet as normal.',
  rejected: 'Something was missing. Correct it below and send the check again.',
  expired: 'This check has aged out. Send fresh papers to carry on taking card payments.',
};

/**
 * Renders the state of the check with its action.
 *
 * @param props The current check.
 * @returns The rendered card.
 */
export function VerificationStatusCard({ verification }: VerificationStatusCardProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const status = verification?.status ?? 'not_started';
  const canSubmit =
    verification !== null &&
    (status === 'in_progress' || status === 'rejected' || status === 'expired');

  /**
   * Sends the check to the platform team.
   *
   * @returns Nothing.
   */
  async function onSubmit(): Promise<void> {
    if (verification === null) {
      return;
    }

    setIsSubmitting(true);
    setFailure(null);

    const result = await submitVerification({ verificationId: verification.id });

    setIsSubmitting(false);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success('Your check is with us.');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Identity check</CardTitle>
            <CardDescription>{EXPLANATIONS[status] ?? EXPLANATIONS['not_started']}</CardDescription>
          </div>
          <StatusBadge kind="kyc" status={status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {failure ? (
          <Alert tone="danger" title="The check was not sent">
            {failure}
          </Alert>
        ) : null}

        {verification?.rejectionReason ? (
          <Alert tone="warning" title="What we need from you">
            {verification.rejectionReason}
          </Alert>
        ) : null}

        {verification?.expiresOn ? (
          <p className="text-sm text-muted-foreground">
            This verification holds good until {formatDate(verification.expiresOn)}.
          </p>
        ) : null}

        {verification?.submittedAt ? (
          <p className="text-sm text-muted-foreground">
            Sent to us on {formatDate(verification.submittedAt)}.
          </p>
        ) : null}

        {canSubmit ? (
          <Button
            type="button"
            isLoading={isSubmitting}
            loadingLabel="Sending"
            onClick={() => {
              void onSubmit();
            }}
          >
            Send for review
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
