// src/components/messaging/send-request-table.tsx
// What a colleague has prepared and asked the owner to send, with approve and
// decline beside each one.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { reviewSendRequest } from '@/features/messaging/actions/review-send-request';
import type { SendRequest } from '@/features/messaging/types';
import { formatDateTime } from '@/lib/dates';
import { humanise } from '@/lib/format';

export interface SendRequestTableProps {
  /** The requests to list. */
  requests: readonly SendRequest[];
  /** False when the signed in account may not approve a send. */
  canApprove: boolean;
}

/**
 * Renders the approval queue.
 *
 * @param props The requests and whether the viewer may act on them.
 * @returns The rendered table.
 */
export function SendRequestTable({ requests, canApprove }: SendRequestTableProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declining, setDeclining] = useState<SendRequest | null>(null);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * Approves or declines one request.
   *
   * @param request Request being reviewed.
   * @param approve True to send the document now.
   * @returns Nothing.
   */
  async function review(request: SendRequest, approve: boolean): Promise<void> {
    setBusyId(request.id);
    setFormError(null);

    const result = await reviewSendRequest({
      requestId: request.id,
      approve,
      reason: approve ? undefined : reason,
    });

    setBusyId(null);

    if (!result.success) {
      setFormError(result.error);
      notify.error(result.error);
      return;
    }

    notify.success(
      approve
        ? 'Approved. The document is on its way to the client.'
        : 'Declined. Your colleague can see why.'
    );

    setDeclining(null);
    setReason('');
    router.refresh();
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        title="Nothing is waiting for you"
        description="When a colleague prepares a document for a client, it waits here for your approval."
      />
    );
  }

  return (
    <>
      {formError ? (
        <Alert tone="danger" title="That did not work" className="mb-4">
          {formError}
        </Alert>
      ) : null}

      <Table caption="Documents waiting for approval">
        <TableHeader>
          <TableRow>
            <TableHead>Recipient</TableHead>
            <TableHead>Prepared by</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead>
              <span className="visually-hidden">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell>
                <span className="block font-medium text-foreground">
                  {request.recipientName ?? request.recipientEmail}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {request.recipientEmail}
                </span>
                {request.customMessage ? (
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {request.customMessage}
                  </span>
                ) : null}
              </TableCell>
              <TableCell>{request.requestedByName ?? 'A colleague'}</TableCell>
              <TableCell>
                <Badge
                  tone={
                    request.status === 'approved'
                      ? 'success'
                      : request.status === 'rejected'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {humanise(request.status)}
                </Badge>
                {request.declineReason ? (
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {request.declineReason}
                  </span>
                ) : null}
              </TableCell>
              <TableCell>{formatDateTime(request.requestedAt)}</TableCell>
              <TableCell>
                {canApprove && request.status === 'pending' ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      isLoading={busyId === request.id}
                      loadingLabel="Sending"
                      onClick={() => {
                        void review(request, true);
                      }}
                    >
                      Approve and send
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busyId === request.id}
                      onClick={() => {
                        setDeclining(request);
                        setReason('');
                      }}
                    >
                      Decline
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">No actions</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal
        isOpen={declining !== null}
        onClose={() => {
          setDeclining(null);
        }}
        title="Decline this send"
        description="Your colleague sees the reason, so they know what to change."
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDeclining(null);
              }}
            >
              Keep it waiting
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={busyId !== null}
              loadingLabel="Declining"
              onClick={() => {
                if (declining) {
                  void review(declining, false);
                }
              }}
            >
              Decline the send
            </Button>
          </div>
        }
      >
        <FormField id="decline-reason" label="Why are you declining?" isRequired>
          <Input
            {...fieldAccessibilityProps('decline-reason', false, false)}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
        </FormField>
      </Modal>
    </>
  );
}
