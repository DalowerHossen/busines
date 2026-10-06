// src/components/contracts/contract-detail-panel.tsx
// One agreement: the wording as it stands, where each party has got to, and
// the buttons that move it on. Everything irreversible asks first.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { notify } from '@/components/ui/toaster';
import { sendContract } from '@/features/contracts/actions/send-contract';
import { voidContract } from '@/features/contracts/actions/void-contract';
import type { ContractDetailRecord } from '@/features/contracts/types';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney, humanise } from '@/lib/format';
import { sanitiseContractHtml } from '@/lib/html/sanitise-contract-html';

export interface ContractDetailPanelProps {
  /** The agreement being shown. */
  contract: ContractDetailRecord;
  /** True when the viewer is the owner and may send or stop it. */
  canSend: boolean;
  /** Currency used when the agreement carries none. */
  fallbackCurrency: string;
}

/**
 * Picks the tone that matches where a party has got to.
 *
 * @param status State recorded on the party.
 * @returns The tone of the badge.
 */
function signerTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'signed') {
    return 'success';
  }

  if (status === 'declined') {
    return 'danger';
  }

  if (status === 'viewed' || status === 'invited') {
    return 'warning';
  }

  return 'neutral';
}

/**
 * Renders one agreement.
 *
 * @param props The agreement and what the viewer may do.
 * @returns The rendered agreement.
 */
export function ContractDetailPanel({
  contract,
  canSend,
  fallbackCurrency,
}: ContractDetailPanelProps) {
  const router = useRouter();
  const [isWorking, setIsWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState(contract.validUntil ?? '');
  const [reason, setReason] = useState('');

  const isDraft = contract.status === 'draft';
  const canStop = contract.status !== 'completed' && contract.status !== 'voided';

  /**
   * Sends the agreement to its parties.
   *
   * @returns Nothing.
   */
  async function onSend(): Promise<void> {
    setIsWorking(true);
    setFailure(null);

    const result = await sendContract({
      contractId: contract.contractId,
      validUntil: validUntil === '' ? undefined : validUntil,
    });

    setIsWorking(false);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success(`Invitations went to ${String(result.data.invitedCount)} parties.`);
    router.refresh();
  }

  /**
   * Stops the agreement before anybody signs it.
   *
   * @returns Nothing.
   */
  async function onVoid(): Promise<void> {
    if (reason.trim().length < 3) {
      setFailure('Say why this agreement is being stopped.');

      return;
    }

    setIsWorking(true);
    setFailure(null);

    const result = await voidContract({ contractId: contract.contractId, reason: reason.trim() });

    setIsWorking(false);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('That agreement has been stopped.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {failure === null ? null : (
        <Alert tone="danger" title="That did not go through">
          {failure}
        </Alert>
      )}

      {contract.declineReason === null ? null : (
        <Alert tone="warning" title="A party declined to sign">
          {contract.declineReason}
        </Alert>
      )}

      {contract.voidReason === null ? null : (
        <Alert tone="warning" title="This agreement was stopped">
          {contract.voidReason}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{contract.title}</CardTitle>
          <CardDescription>
            {contract.contractNumber} · {contract.clientName ?? 'not attached to a client'} ·{' '}
            {contract.contractValue === null
              ? 'no value recorded'
              : formatMoney(contract.contractValue, contract.currency ?? fallbackCurrency)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone={contract.status === 'completed' ? 'success' : 'neutral'}>
              {humanise(contract.status)}
            </Badge>
            <Badge tone="neutral">{`${contract.signedCount} of ${contract.signerCount} signed`}</Badge>
            {contract.contentHash === null ? null : <Badge tone="neutral">Wording frozen</Badge>}
            {contract.sealedAt === null ? null : <Badge tone="success">Sealed copy stored</Badge>}
          </div>

          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Starts</dt>
              <dd className="text-sm font-medium">
                {contract.effectiveDate === null ? '—' : formatDate(contract.effectiveDate)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Ends</dt>
              <dd className="text-sm font-medium">
                {contract.expiryDate === null ? '—' : formatDate(contract.expiryDate)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Signing closes</dt>
              <dd className="text-sm font-medium">
                {contract.validUntil === null ? '—' : formatDate(contract.validUntil)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">First opened</dt>
              <dd className="text-sm font-medium">
                {contract.firstViewedAt === null
                  ? 'Not yet'
                  : formatDateTime(contract.firstViewedAt)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The parties</CardTitle>
          <CardDescription>
            {contract.signingOrderEnforced
              ? 'Signatures are collected in the order below.'
              : 'Anybody listed can sign at any time.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {contract.signers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nobody has been named yet. Edit the agreement to add the people who have to sign.
            </p>
          ) : (
            contract.signers.map((signer) => (
              <div
                key={signer.signerId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {`${String(signer.signingOrder)}. ${signer.fullName}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {signer.email} · signing as {signer.roleLabel}
                    {signer.isInternal ? ' · our side' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {signer.signedAt === null ? null : (
                    <span className="text-sm text-muted-foreground">
                      {formatDateTime(signer.signedAt)}
                    </span>
                  )}
                  <Badge tone={signerTone(signer.status)}>{humanise(signer.status)}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The wording</CardTitle>
          <CardDescription>
            This is exactly what each party is shown when they open their link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[32rem] overflow-auto rounded-md border border-border bg-surface p-4 text-sm leading-relaxed">
            <div dangerouslySetInnerHTML={{ __html: sanitiseContractHtml(contract.bodyHtml) }} />
          </div>
        </CardContent>
      </Card>

      {canSend ? (
        <Card>
          <CardHeader>
            <CardTitle>Move it on</CardTitle>
            <CardDescription>
              Sending freezes the wording and gives every party their own private link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isDraft ? (
              <div className="flex flex-wrap items-end gap-3">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Signing closes on</span>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(event) => setValidUntil(event.target.value)}
                  />
                </label>
                <Button
                  type="button"
                  isLoading={isWorking}
                  loadingLabel="Sending"
                  onClick={() => void onSend()}
                >
                  Send for signature
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                This agreement has already gone out, so the wording can no longer be changed.
              </p>
            )}

            {canStop ? (
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-[16rem] flex-1 space-y-1 text-sm">
                  <span className="font-medium">Why stop it</span>
                  <Input
                    value={reason}
                    placeholder="Replaced by a new version"
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isWorking}
                  onClick={() => void onVoid()}
                >
                  Stop this agreement
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
