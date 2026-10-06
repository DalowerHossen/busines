// src/components/receipts/receipt-review-queue.tsx
// The working screen. Each receipt shows what was read, marks the fields the
// reader was least sure about, and lets a person correct them before the
// receipt becomes a draft expense.

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { ROUTES } from '@/config/app';
import { notify } from '@/components/ui/toaster';
import { acceptReceipt } from '@/features/receipts/actions/accept-receipt';
import { correctReceipt } from '@/features/receipts/actions/correct-receipt';
import { discardReceipt } from '@/features/receipts/actions/discard-receipt';
import type { ReceiptSummaryRecord } from '@/features/receipts/types';
import { formatDate, formatDateTime } from '@/lib/dates';
import { humanise } from '@/lib/format';

export interface ReceiptReviewQueueProps {
  /** The receipts waiting for somebody. */
  receipts: readonly ReceiptSummaryRecord[];
  /** False when the viewer may look but not decide. */
  canDecide: boolean;
}

interface DraftFields {
  merchantName: string;
  receiptDate: string;
  currency: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
}

/**
 * Picks the tone that matches how sure the reader was.
 *
 * @param confidence Confidence recorded on the receipt.
 * @returns The tone of the badge.
 */
function confidenceTone(confidence: string | null): 'success' | 'warning' | 'neutral' {
  const value = Number(confidence ?? '0');

  if (value >= 90) {
    return 'success';
  }

  if (value >= 70) {
    return 'warning';
  }

  return 'neutral';
}

/**
 * Builds the editable fields from what the reader found.
 *
 * @param receipt The receipt as it stands.
 * @returns The starting values for the form.
 */
function draftOf(receipt: ReceiptSummaryRecord): DraftFields {
  return {
    merchantName: receipt.merchantName ?? '',
    receiptDate: receipt.receiptDate ?? '',
    currency: receipt.currency ?? '',
    subtotalAmount: receipt.subtotalAmount ?? '',
    taxAmount: receipt.taxAmount ?? '',
    totalAmount: receipt.totalAmount ?? '',
  };
}

/**
 * Renders the receipt review queue.
 *
 * @param props The receipts and what the viewer may do.
 * @returns The rendered queue.
 */
export function ReceiptReviewQueue({ receipts, canDecide }: ReceiptReviewQueueProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftFields>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  /**
   * Reads the working copy of one receipt.
   *
   * @param receipt The receipt being edited.
   * @returns The values currently in the form.
   */
  function fieldsFor(receipt: ReceiptSummaryRecord): DraftFields {
    return drafts[receipt.scanId] ?? draftOf(receipt);
  }

  /**
   * Records a change to one field.
   *
   * @param receipt The receipt being edited.
   * @param key The field that changed.
   * @param value The new value.
   * @returns Nothing.
   */
  function onChange(receipt: ReceiptSummaryRecord, key: keyof DraftFields, value: string): void {
    const current = fieldsFor(receipt);

    setDrafts({ ...drafts, [receipt.scanId]: { ...current, [key]: value } });
  }

  /**
   * Saves the corrections made to one receipt.
   *
   * @param receipt The receipt being corrected.
   * @returns Nothing.
   */
  async function onCorrect(receipt: ReceiptSummaryRecord): Promise<void> {
    const fields = fieldsFor(receipt);

    setBusyId(receipt.scanId);
    setFailure(null);

    const result = await correctReceipt({
      scanId: receipt.scanId,
      merchantName: fields.merchantName.trim() === '' ? undefined : fields.merchantName.trim(),
      receiptDate: fields.receiptDate.trim() === '' ? undefined : fields.receiptDate.trim(),
      currency: fields.currency.trim() === '' ? undefined : fields.currency.trim().toUpperCase(),
      subtotalAmount:
        fields.subtotalAmount.trim() === '' ? undefined : fields.subtotalAmount.trim(),
      taxAmount: fields.taxAmount.trim() === '' ? undefined : fields.taxAmount.trim(),
      totalAmount: fields.totalAmount.trim() === '' ? undefined : fields.totalAmount.trim(),
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('Those corrections are saved.');
    router.refresh();
  }

  /**
   * Turns one receipt into a draft expense.
   *
   * @param receipt The receipt being accepted.
   * @returns Nothing.
   */
  async function onAccept(receipt: ReceiptSummaryRecord): Promise<void> {
    setBusyId(receipt.scanId);
    setFailure(null);

    const result = await acceptReceipt({ scanId: receipt.scanId });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('That receipt is now a draft expense.');
    router.refresh();
  }

  /**
   * Throws one receipt away.
   *
   * @param receipt The receipt being discarded.
   * @returns Nothing.
   */
  async function onDiscard(receipt: ReceiptSummaryRecord): Promise<void> {
    const reason = reasons[receipt.scanId] ?? '';

    if (reason.trim().length < 3) {
      setFailure('Say why this receipt is being thrown away before discarding it.');

      return;
    }

    setBusyId(receipt.scanId);
    setFailure(null);

    const result = await discardReceipt({ scanId: receipt.scanId, reason: reason.trim() });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('That receipt has been thrown away.');
    router.refresh();
  }

  if (receipts.length === 0) {
    return (
      <EmptyState
        title="Nothing is waiting"
        description="Every receipt sent in has been dealt with. Send another one and it will appear here once it has been read."
      />
    );
  }

  return (
    <div className="space-y-4">
      {failure === null ? null : (
        <Alert tone="danger" title="That did not go through">
          {failure}
        </Alert>
      )}

      {receipts.map((receipt) => {
        const fields = fieldsFor(receipt);
        const isBusy = busyId === receipt.scanId;
        const low = new Set(receipt.lowConfidenceFields);

        return (
          <Card key={receipt.scanId}>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium">{receipt.merchantName ?? receipt.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    Sent in {formatDateTime(receipt.uploadedAt)} from {humanise(receipt.source)}
                    {receipt.receiptDate === null
                      ? ''
                      : ` · dated ${formatDate(receipt.receiptDate)}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={confidenceTone(receipt.overallConfidence)}>
                    {`${Math.round(Number(receipt.overallConfidence ?? '0'))}% sure`}
                  </Badge>
                  <Badge tone={receipt.status === 'failed' ? 'danger' : 'neutral'}>
                    {humanise(receipt.status)}
                  </Badge>
                </div>
              </div>

              {receipt.errorMessage === null ? null : (
                <Alert tone="warning" title="The reader had trouble">
                  {receipt.errorMessage}
                </Alert>
              )}

              {receipt.lowConfidenceFields.length === 0 ? null : (
                <Alert tone="info" title="Check these before accepting">
                  {receipt.lowConfidenceFields.map((field) => humanise(field)).join(', ')}
                </Alert>
              )}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Merchant</span>
                  <Input
                    value={fields.merchantName}
                    isInvalid={low.has('merchant_name')}
                    disabled={!canDecide || isBusy}
                    onChange={(event) => onChange(receipt, 'merchantName', event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Date</span>
                  <Input
                    type="date"
                    value={fields.receiptDate}
                    isInvalid={low.has('receipt_date')}
                    disabled={!canDecide || isBusy}
                    onChange={(event) => onChange(receipt, 'receiptDate', event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Currency</span>
                  <Input
                    value={fields.currency}
                    maxLength={3}
                    isInvalid={low.has('currency')}
                    disabled={!canDecide || isBusy}
                    onChange={(event) => onChange(receipt, 'currency', event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Net</span>
                  <Input
                    inputMode="decimal"
                    value={fields.subtotalAmount}
                    isInvalid={low.has('subtotal_amount')}
                    disabled={!canDecide || isBusy}
                    onChange={(event) => onChange(receipt, 'subtotalAmount', event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Tax</span>
                  <Input
                    inputMode="decimal"
                    value={fields.taxAmount}
                    isInvalid={low.has('tax_amount')}
                    disabled={!canDecide || isBusy}
                    onChange={(event) => onChange(receipt, 'taxAmount', event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Total</span>
                  <Input
                    inputMode="decimal"
                    value={fields.totalAmount}
                    isInvalid={low.has('total_amount')}
                    disabled={!canDecide || isBusy}
                    onChange={(event) => onChange(receipt, 'totalAmount', event.target.value)}
                  />
                </label>
              </div>

              <p className="text-sm text-muted-foreground">
                {receipt.lineCount === 0
                  ? 'No individual items were found on this receipt.'
                  : `${receipt.lineCount} items were found on this receipt.`}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!canDecide || isBusy}
                  onClick={() => void onCorrect(receipt)}
                >
                  Save corrections
                </Button>
                <Button
                  type="button"
                  isLoading={isBusy}
                  loadingLabel="Working"
                  disabled={!canDecide || isBusy}
                  onClick={() => void onAccept(receipt)}
                >
                  Make it an expense
                </Button>
                <Link
                  href={`${ROUTES.expenses}/receipts/${receipt.scanId}`}
                  className="flex min-h-touch items-center text-sm font-medium text-brand-700 underline-offset-4 hover:underline"
                >
                  See everything that was read
                </Link>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-[16rem] flex-1 space-y-1 text-sm">
                  <span className="font-medium">Why throw it away</span>
                  <Input
                    value={reasons[receipt.scanId] ?? ''}
                    placeholder="Not a business cost"
                    disabled={!canDecide || isBusy}
                    onChange={(event) =>
                      setReasons({ ...reasons, [receipt.scanId]: event.target.value })
                    }
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!canDecide || isBusy}
                  onClick={() => void onDiscard(receipt)}
                >
                  Throw away
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
