// src/components/disputes/dispute-workbench.tsx
// Answering one chargeback: gather what the platform already knows, add
// anything it cannot know, send the file, and record how it ended.

'use client';

import { FileStack } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { addEvidenceNote } from '@/features/disputes/actions/add-evidence-note';
import { assembleEvidence } from '@/features/disputes/actions/assemble-evidence';
import { recordDisputeOutcome } from '@/features/disputes/actions/record-outcome';
import { submitEvidence } from '@/features/disputes/actions/submit-evidence';
import type { DisputeDetail } from '@/features/disputes/types';
import { formatDateTime } from '@/lib/dates';
import { formatMoney, humanise } from '@/lib/format';

export interface DisputeWorkbenchProps {
  /** The dispute being worked on. */
  dispute: DisputeDetail;
  /** False when the signed in account may only read. */
  canEdit: boolean;
  /** True when the signed in account may send and decide. */
  canDecide: boolean;
}

const OUTCOME_OPTIONS = [
  { value: 'won', label: 'Won, the money stays with us' },
  { value: 'lost', label: 'Lost, the money has been taken back' },
  { value: 'withdrawn', label: 'Withdrawn by the client' },
];

/**
 * Renders the workbench for one chargeback.
 *
 * @param props The dispute and what the viewer may do.
 * @returns The rendered workbench.
 */
export function DisputeWorkbench({ dispute, canEdit, canDecide }: DisputeWorkbenchProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [outcome, setOutcome] = useState('won');
  const [note, setNote] = useState('');
  const [recovered, setRecovered] = useState(dispute.disputedAmount);

  const isDecided = ['won', 'lost', 'withdrawn'].includes(dispute.status);

  /**
   * Gathers the evidence the platform already holds.
   *
   * @returns Nothing.
   */
  async function handleAssemble(): Promise<void> {
    setBusy('assemble');
    setFailure(null);

    const result = await assembleEvidence({ disputeId: dispute.id });
    setBusy(null);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success(`${result.data.itemCount} item(s) gathered into the evidence file.`);
    router.refresh();
  }

  /**
   * Adds a written statement to the evidence.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleAddNote(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy('note');
    setFailure(null);

    const result = await addEvidenceNote({ disputeId: dispute.id, title, detail });
    setBusy(null);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success('Added to the evidence file.');
    setTitle('');
    setDetail('');
    router.refresh();
  }

  /**
   * Sends the evidence file to the provider.
   *
   * @returns Nothing.
   */
  async function handleSubmit(): Promise<void> {
    setBusy('submit');
    setFailure(null);

    const result = await submitEvidence({ disputeId: dispute.id });
    setBusy(null);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success('The evidence has been marked as sent.');
    router.refresh();
  }

  /**
   * Records how the dispute ended.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleOutcome(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy('outcome');
    setFailure(null);

    const result = await recordDisputeOutcome({
      disputeId: dispute.id,
      status: outcome === 'lost' ? 'lost' : outcome === 'withdrawn' ? 'withdrawn' : 'won',
      note,
      recoveredAmount: outcome === 'won' ? recovered : '0',
    });

    setBusy(null);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success('The outcome has been recorded.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {failure ? (
        <Alert tone="danger" title="That did not work">
          {failure}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>The evidence file</CardTitle>
          <CardDescription>
            {dispute.evidence.length === 0
              ? 'Nothing has been gathered yet. Start with what the platform already holds about this invoice.'
              : `${dispute.evidence.length} item(s) gathered. Evidence is never edited once collected, so each entry stands as it was written.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {dispute.evidence.length > 0 ? (
            <ul className="space-y-3">
              {dispute.evidence.map((item) => (
                <li key={item.id} className="rounded-md border border-border bg-surface p-4">
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {humanise(item.evidenceType)} · gathered {formatDateTime(item.collectedAt)}
                  </p>
                  {item.description ? (
                    <p className="mt-1 whitespace-pre-line text-sm text-foreground">
                      {item.description}
                    </p>
                  ) : null}
                  {item.fileName ? (
                    <p className="mt-1 text-sm text-muted-foreground">File: {item.fileName}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {canEdit && !isDecided ? (
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                isLoading={busy === 'assemble'}
                loadingLabel="Gathering"
                leadingIcon={<FileStack aria-hidden="true" className="h-4 w-4" />}
                onClick={() => {
                  void handleAssemble();
                }}
              >
                Gather what we already hold
              </Button>

              {canDecide && dispute.evidence.length > 0 ? (
                <Button
                  type="button"
                  isLoading={busy === 'submit'}
                  loadingLabel="Sending"
                  disabled={dispute.evidenceSubmittedAt !== null}
                  onClick={() => {
                    void handleSubmit();
                  }}
                >
                  {dispute.evidenceSubmittedAt === null
                    ? 'Mark the evidence as sent'
                    : `Sent ${formatDateTime(dispute.evidenceSubmittedAt)}`}
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canEdit && !isDecided ? (
        <Card>
          <CardHeader>
            <CardTitle>Add something we cannot know</CardTitle>
            <CardDescription>
              A telephone call, a signed delivery sheet, a conversation on another channel.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              noValidate
              className="space-y-4"
              onSubmit={(event) => {
                void handleAddNote(event);
              }}
            >
              <FormField id="evidence-title" label="Title" isRequired>
                <Input
                  {...fieldAccessibilityProps('evidence-title', false, false)}
                  value={title}
                  placeholder="Delivery confirmed by telephone"
                  disabled={busy === 'note'}
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                />
              </FormField>

              <FormField id="evidence-detail" label="What it shows" isRequired>
                <Textarea
                  {...fieldAccessibilityProps('evidence-detail', false, false)}
                  rows={4}
                  value={detail}
                  disabled={busy === 'note'}
                  onChange={(event) => {
                    setDetail(event.target.value);
                  }}
                />
              </FormField>

              <Button
                type="submit"
                variant="secondary"
                isLoading={busy === 'note'}
                loadingLabel="Adding"
                disabled={title.trim().length < 2 || detail.trim().length < 4}
              >
                Add to the evidence
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {canDecide && !isDecided ? (
        <Card>
          <CardHeader>
            <CardTitle>Record the outcome</CardTitle>
            <CardDescription>
              Once the provider has decided, write it down here. A dispute that was lost leaves the
              payment charged back and the invoice outstanding again.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              noValidate
              className="space-y-4"
              onSubmit={(event) => {
                void handleOutcome(event);
              }}
            >
              <FormField id="outcome-status" label="How it ended">
                <Select
                  id="outcome-status"
                  options={OUTCOME_OPTIONS}
                  value={outcome}
                  disabled={busy === 'outcome'}
                  onChange={(event) => {
                    setOutcome(event.target.value);
                  }}
                />
              </FormField>

              {outcome === 'won' ? (
                <FormField
                  id="outcome-recovered"
                  label="Amount recovered"
                  hint={`At most ${formatMoney(dispute.disputedAmount, dispute.currency)}.`}
                >
                  <Input
                    {...fieldAccessibilityProps('outcome-recovered', true, false)}
                    type="number"
                    step="0.01"
                    min="0"
                    max={dispute.disputedAmount}
                    value={recovered}
                    disabled={busy === 'outcome'}
                    onChange={(event) => {
                      setRecovered(event.target.value);
                    }}
                  />
                </FormField>
              ) : null}

              <FormField id="outcome-note" label="Note for your records">
                <Textarea
                  {...fieldAccessibilityProps('outcome-note', false, false)}
                  rows={3}
                  value={note}
                  disabled={busy === 'outcome'}
                  onChange={(event) => {
                    setNote(event.target.value);
                  }}
                />
              </FormField>

              <Button type="submit" isLoading={busy === 'outcome'} loadingLabel="Saving">
                Record the outcome
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {isDecided ? (
        <Alert
          tone={dispute.status === 'won' ? 'success' : 'warning'}
          title={`This dispute was ${humanise(dispute.status).toLowerCase()}`}
        >
          {dispute.outcomeNote ??
            `${formatMoney(dispute.recoveredAmount, dispute.currency)} of ${formatMoney(
              dispute.disputedAmount,
              dispute.currency
            )} was recovered.`}
        </Alert>
      ) : null}
    </div>
  );
}
