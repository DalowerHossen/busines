// src/components/contracts/signing-panel.tsx
// What the person holding the invitation sees. The wording first, then the
// consent, then the signature, in that order, because that is the order a
// court would expect.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { notify } from '@/components/ui/toaster';
import { declineContractFromLink } from '@/features/contracts/actions/decline-contract';
import { signContractFromLink } from '@/features/contracts/actions/sign-contract';
import type { SigningInvitation } from '@/features/contracts/types';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { sanitiseContractHtml } from '@/lib/html/sanitise-contract-html';

export interface SigningPanelProps {
  /** The invitation being answered. */
  invitation: SigningInvitation;
  /** The token from the address, sent back with the answer. */
  token: string;
}

/** The words the signer agrees to before the signature counts. */
const CONSENT_LABEL =
  'I agree to sign this document electronically and that my electronic signature is as binding as a handwritten one.';

/**
 * Renders the signing page.
 *
 * @param props The invitation and the token.
 * @returns The rendered page.
 */
export function SigningPanel({ invitation, token }: SigningPanelProps) {
  const router = useRouter();
  const [typedSignature, setTypedSignature] = useState(invitation.fullName);
  const [hasConsented, setHasConsented] = useState(false);
  const [reason, setReason] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Signs the agreement.
   *
   * @returns Nothing.
   */
  async function onSign(): Promise<void> {
    if (!hasConsented) {
      setFailure('Tick the box to agree to sign electronically.');

      return;
    }

    setIsWorking(true);
    setFailure(null);

    const result = await signContractFromLink({
      token,
      typedSignature,
      hasConsented: true,
    });

    setIsWorking(false);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('Thank you. Your signature has been recorded.');
    router.refresh();
  }

  /**
   * Refuses to sign.
   *
   * @returns Nothing.
   */
  async function onDecline(): Promise<void> {
    if (reason.trim().length < 3) {
      setFailure('Say why you are not signing, so the sender knows.');

      return;
    }

    setIsWorking(true);
    setFailure(null);

    const result = await declineContractFromLink({ token, reason: reason.trim() });

    setIsWorking(false);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('The sender has been told you are not signing.');
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-content space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{invitation.title}</CardTitle>
          <CardDescription>
            {invitation.companyName === null
              ? invitation.contractNumber
              : `${invitation.companyName} · ${invitation.contractNumber}`}
            {invitation.contractValue === null
              ? ''
              : ` · ${formatMoney(invitation.contractValue, invitation.currency ?? 'USD')}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You are being asked to sign as {invitation.roleLabel}.
            {invitation.effectiveDate === null
              ? ''
              : ` The agreement starts on ${formatDate(invitation.effectiveDate)}.`}
            {invitation.validUntil === null
              ? ''
              : ` Please sign by ${formatDate(invitation.validUntil)}.`}
          </p>
          <div className="max-h-[40rem] overflow-auto rounded-md border border-border bg-surface p-4 text-sm leading-relaxed">
            <div dangerouslySetInnerHTML={{ __html: sanitiseContractHtml(invitation.bodyHtml) }} />
          </div>
        </CardContent>
      </Card>

      {invitation.signerStatus === 'signed' ? (
        <Alert tone="success" title="You have signed this agreement">
          {invitation.signedAt === null
            ? 'Your signature is recorded. You can close this page.'
            : `Your signature was recorded on ${formatDateTime(invitation.signedAt)}. You can close this page.`}
        </Alert>
      ) : null}

      {invitation.signerStatus === 'declined' ? (
        <Alert tone="warning" title="You declined to sign">
          The sender has been told. If that was a mistake, reply to the email you were sent.
        </Alert>
      ) : null}

      {invitation.waitingForOthers && invitation.isOpen ? (
        <Alert tone="info" title="It is not your turn yet">
          This agreement is signed in order, and somebody ahead of you has still to sign. You will
          be able to sign once they have.
        </Alert>
      ) : null}

      {!invitation.isOpen &&
      invitation.signerStatus !== 'signed' &&
      invitation.signerStatus !== 'declined' ? (
        <Alert tone="warning" title="This agreement is not open for signature">
          The signing window may have closed, or the sender may have stopped it. Reply to the email
          you were sent and they will put it right.
        </Alert>
      ) : null}

      {invitation.isOpen && !invitation.waitingForOthers ? (
        <Card>
          <CardHeader>
            <CardTitle>Sign the agreement</CardTitle>
            <CardDescription>
              Type your full name exactly as you would write it. The date, your address and the
              wording you were shown are all recorded with your signature.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {failure === null ? null : (
              <Alert tone="danger" title="That did not go through">
                {failure}
              </Alert>
            )}

            <label className="space-y-1 text-sm">
              <span className="font-medium">Your full name</span>
              <Input
                value={typedSignature}
                onChange={(event) => setTypedSignature(event.target.value)}
              />
            </label>

            <Checkbox
              checked={hasConsented}
              label={CONSENT_LABEL}
              onChange={(event) => setHasConsented(event.target.checked)}
            />

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                isLoading={isWorking}
                loadingLabel="Signing"
                onClick={() => void onSign()}
              >
                Sign the agreement
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
              <label className="min-w-[16rem] flex-1 space-y-1 text-sm">
                <span className="font-medium">Not signing? Tell them why</span>
                <Input
                  value={reason}
                  placeholder="The scope needs to change first"
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                disabled={isWorking}
                onClick={() => void onDecline()}
              >
                Decline to sign
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
