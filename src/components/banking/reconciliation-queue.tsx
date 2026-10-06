// src/components/banking/reconciliation-queue.tsx
// The working screen: one statement line at a time, with everything that
// could explain it already offered, and one click to accept, set aside or
// undo. A line is never guessed on anybody's behalf.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { notify } from '@/components/ui/toaster';
import { ignoreBankLine } from '@/features/banking/actions/ignore-line';
import { settleBankLine } from '@/features/banking/actions/settle-line';
import { splitBankLine } from '@/features/banking/actions/split-line';
import { unmatchBankLine } from '@/features/banking/actions/unmatch-line';
import type { ReviewQueueEntry } from '@/features/banking/queries/list-review-queue';
import type { MatchCandidate } from '@/features/banking/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface ReconciliationQueueProps {
  /** The lines waiting for a decision, with their candidates. */
  entries: readonly ReviewQueueEntry[];
  /** False when the viewer may look but not decide. */
  canDecide: boolean;
}

/**
 * Picks the tone that matches how sure a suggestion is.
 *
 * @param confidence Confidence recorded on the suggestion.
 * @returns The tone of the badge.
 */
function confidenceTone(confidence: string): 'success' | 'warning' | 'neutral' {
  const value = Number(confidence);

  if (value >= 90) {
    return 'success';
  }

  if (value >= 70) {
    return 'warning';
  }

  return 'neutral';
}

/**
 * Renders the reconciliation queue.
 *
 * @param props The queue and what the viewer may do.
 * @returns The rendered queue.
 */
export function ReconciliationQueue({ entries, canDecide }: ReconciliationQueueProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [splittingId, setSplittingId] = useState<string | null>(null);
  const [splitFirst, setSplitFirst] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  /**
   * Accepts one suggestion.
   *
   * @param entry Line being settled.
   * @param candidate Record said to explain it.
   * @returns Nothing.
   */
  async function onAccept(entry: ReviewQueueEntry, candidate: MatchCandidate): Promise<void> {
    setBusyId(entry.line.bankTransactionId);
    setFailure(null);

    const result = await settleBankLine({
      bankTransactionId: entry.line.bankTransactionId,
      recordType: candidate.recordType,
      recordId: candidate.recordId,
      confidence: candidate.confidence,
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('That line is settled.');
    router.refresh();
  }

  /**
   * Puts one line away.
   *
   * @param entry Line being set aside.
   * @returns Nothing.
   */
  async function onIgnore(entry: ReviewQueueEntry): Promise<void> {
    const reason = reasons[entry.line.bankTransactionId] ?? '';

    if (reason.trim().length < 3) {
      setFailure('Say why the line is being set aside before putting it away.');

      return;
    }

    setBusyId(entry.line.bankTransactionId);
    setFailure(null);

    const result = await ignoreBankLine({
      bankTransactionId: entry.line.bankTransactionId,
      reason,
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('That line has been set aside.');
    router.refresh();
  }

  /**
   * Undoes a match that turned out to be wrong.
   *
   * A statement line matched to the wrong invoice is worse than one left
   * alone, because the invoice then looks paid. Undoing has to be as easy
   * as matching was.
   *
   * @param entry The line being put back.
   * @returns Nothing.
   */
  async function handleUnmatch(entry: ReviewQueueEntry): Promise<void> {
    setBusyId(entry.line.bankTransactionId);
    setFailure(null);

    const result = await unmatchBankLine({
      bankTransactionId: entry.line.bankTransactionId,
      reason: 'Matched to the wrong record.',
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('Put back. The line is waiting for a decision again.');
    router.refresh();
  }

  /**
   * Splits one line into two, for a payment that covers more than one thing.
   *
   * @param entry The line being split.
   * @returns Nothing.
   */
  async function handleSplit(entry: ReviewQueueEntry): Promise<void> {
    const firstAmount = Number.parseFloat(splitFirst);
    const total = Number.parseFloat(entry.line.amount);

    if (!Number.isFinite(firstAmount) || firstAmount === 0) {
      setFailure('Enter what the first part of this line is worth.');

      return;
    }

    if (Math.abs(firstAmount) >= Math.abs(total)) {
      setFailure('The first part has to be smaller than the line itself.');

      return;
    }

    setBusyId(entry.line.bankTransactionId);
    setFailure(null);

    const result = await splitBankLine({
      bankTransactionId: entry.line.bankTransactionId,
      parts: [
        { amount: firstAmount, note: 'First part' },
        { amount: Number((total - firstAmount).toFixed(2)), note: 'What is left' },
      ],
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('Split. Each part can now be explained on its own.');
    setSplittingId(null);
    setSplitFirst('');
    router.refresh();
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        title="Everything the bank has sent is explained"
        description="New statement lines appear here as soon as the next read of your bank brings them in."
      />
    );
  }

  return (
    <div className="space-y-4">
      {failure ? (
        <Alert tone="danger" title="That did not work">
          {failure}
        </Alert>
      ) : null}

      <ul className="space-y-4">
        {entries.map((entry) => {
          const isMoneyIn = Number(entry.line.amount) > 0;

          return (
            <li key={entry.line.bankTransactionId}>
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{entry.line.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(entry.line.transactionDate)} · {entry.line.bankAccountName} ·{' '}
                        {humanise(entry.line.importSource)}
                        {entry.line.reference ? ` · ${entry.line.reference}` : ''}
                      </p>
                      {Number(entry.line.rememberedConfidence) > 0 ? (
                        <p className="text-sm text-muted-foreground">
                          You have categorised this counterparty before, so the engine already has
                          an opinion about it.
                        </p>
                      ) : null}
                    </div>

                    <div className="text-right">
                      <p
                        className={
                          isMoneyIn
                            ? 'tabular text-lg font-semibold text-success'
                            : 'tabular text-lg font-semibold'
                        }
                      >
                        {formatMoney(entry.line.amount, entry.line.currency)}
                      </p>
                      <Badge tone={isMoneyIn ? 'success' : 'neutral'}>
                        {isMoneyIn ? 'Money in' : 'Money out'}
                      </Badge>
                    </div>
                  </div>

                  {entry.candidates.length === 0 ? (
                    <Alert tone="info" title="Nothing in the books matches this yet">
                      Record the expense or the payment first, and it will be offered here the next
                      time this page is opened.
                    </Alert>
                  ) : (
                    <ul className="space-y-2">
                      {entry.candidates.map((candidate) => (
                        <li
                          key={`${candidate.recordType}-${candidate.recordId}`}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{candidate.recordLabel}</span>
                              <Badge tone="neutral">{humanise(candidate.recordType)}</Badge>
                              <Badge tone={confidenceTone(candidate.confidence)}>
                                {formatNumber(Number(candidate.confidence))} out of 100
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {candidate.matchReason} ·{' '}
                              {formatMoney(candidate.matchedAmount, entry.line.currency)}
                            </p>
                          </div>

                          {canDecide ? (
                            <Button
                              type="button"
                              size="sm"
                              isLoading={busyId === entry.line.bankTransactionId}
                              loadingLabel="Settling"
                              onClick={() => {
                                void onAccept(entry, candidate);
                              }}
                            >
                              This is it
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}

                  {canDecide ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <Input
                        aria-label={`Why the line on ${formatDate(
                          entry.line.transactionDate
                        )} is being set aside`}
                        placeholder="Reason for setting this aside"
                        value={reasons[entry.line.bankTransactionId] ?? ''}
                        onChange={(event) => {
                          setReasons((state) => ({
                            ...state,
                            [entry.line.bankTransactionId]: event.target.value,
                          }));
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        isLoading={busyId === entry.line.bankTransactionId}
                        loadingLabel="Putting away"
                        onClick={() => {
                          void onIgnore(entry);
                        }}
                      >
                        Nothing to do with the books
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSplittingId(
                            splittingId === entry.line.bankTransactionId
                              ? null
                              : entry.line.bankTransactionId
                          );
                          setSplitFirst('');
                        }}
                      >
                        {splittingId === entry.line.bankTransactionId
                          ? 'Leave it whole'
                          : 'This covers more than one thing'}
                      </Button>

                      {entry.line.status === 'matched' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          isLoading={busyId === entry.line.bankTransactionId}
                          loadingLabel="Putting back"
                          onClick={() => {
                            void handleUnmatch(entry);
                          }}
                        >
                          That match was wrong
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  {canDecide && splittingId === entry.line.bankTransactionId ? (
                    <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                      <Input
                        aria-label="What the first part of this line is worth"
                        type="number"
                        step="0.01"
                        placeholder={`Part of ${formatMoney(entry.line.amount, entry.line.currency)}`}
                        value={splitFirst}
                        onChange={(event) => {
                          setSplitFirst(event.target.value);
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        isLoading={busyId === entry.line.bankTransactionId}
                        loadingLabel="Splitting"
                        onClick={() => {
                          void handleSplit(entry);
                        }}
                      >
                        Split it in two
                      </Button>
                      <p className="w-full text-sm text-muted-foreground">
                        The rest stays as a second line, so each part can be explained on its own.
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
