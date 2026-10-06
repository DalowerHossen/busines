// src/components/estimates/estimate-actions-bar.tsx
// The actions offered on the page of one quotation: send a draft, record what
// the client decided, turn an accepted quotation into an invoice, or withdraw
// one that will not be pursued.

'use client';

import { Ban, CheckCircle2, FileText, Printer, Send, ThumbsDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { approveEstimate } from '@/features/estimates/actions/approve-estimate';
import { cancelEstimate } from '@/features/estimates/actions/cancel-estimate';
import { convertEstimate } from '@/features/estimates/actions/convert-estimate';
import { declineEstimate } from '@/features/estimates/actions/decline-estimate';
import { sendEstimate } from '@/features/estimates/actions/send-estimate';
import {
  canCancelEstimate,
  canConvertEstimate,
  canDecideEstimate,
  canSendEstimate,
} from '@/features/estimates/status';
import type { EstimateDetail } from '@/features/estimates/types';

export interface EstimateActionsBarProps {
  /** Estimate the actions apply to. */
  estimate: EstimateDetail;
  /** False when the signed in account may only read. */
  canEdit: boolean;
  /** False when the signed in account may not raise an invoice. */
  canCreateInvoice: boolean;
}

type Prompt = 'approve' | 'decline' | 'withdraw' | null;

/**
 * Renders the action buttons on the estimate page.
 *
 * @param props The estimate and what the account may do.
 * @returns The rendered buttons.
 */
export function EstimateActionsBar({
  estimate,
  canEdit,
  canCreateInvoice,
}: EstimateActionsBarProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [text, setText] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  /**
   * Sends the quotation to the client.
   *
   * @returns Nothing.
   */
  async function handleSend(): Promise<void> {
    setIsWorking(true);
    const result = await sendEstimate({ estimateId: estimate.id });
    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    notify.success(`Estimate ${result.data.estimateNumber} sent.`);
    router.refresh();
  }

  /**
   * Turns an accepted quotation into a draft invoice.
   *
   * @returns Nothing.
   */
  async function handleConvert(): Promise<void> {
    setIsWorking(true);
    const result = await convertEstimate({ estimateId: estimate.id });
    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    notify.success('Draft invoice created from this estimate.');
    router.push(`${ROUTES.invoices}/${result.data.invoiceId}`);
  }

  /**
   * Saves whichever decision the person is recording.
   *
   * @returns Nothing.
   */
  async function confirmPrompt(): Promise<void> {
    if (prompt === null) {
      return;
    }

    setIsWorking(true);

    const result =
      prompt === 'approve'
        ? await approveEstimate({ estimateId: estimate.id, approvedByName: text })
        : prompt === 'decline'
          ? await declineEstimate({ estimateId: estimate.id, reason: text })
          : await cancelEstimate({ estimateId: estimate.id, reason: text });

    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    setPrompt(null);
    setText('');
    notify.success(
      prompt === 'approve'
        ? 'Marked as accepted by the client.'
        : prompt === 'decline'
          ? 'Marked as declined.'
          : 'Estimate withdrawn.'
    );
    router.refresh();
  }

  const isApproval = prompt === 'approve';
  const isReady = isApproval || text.trim().length >= 3;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="secondary"
        leadingIcon={<Printer aria-hidden="true" className="h-4 w-4" />}
        onClick={() => {
          window.print();
        }}
      >
        Print
      </Button>

      {canSendEstimate(estimate.status, estimate.lines.length) ? (
        <Button
          type="button"
          isLoading={isWorking}
          loadingLabel="Sending"
          disabled={!canEdit}
          leadingIcon={<Send aria-hidden="true" className="h-4 w-4" />}
          onClick={() => {
            void handleSend();
          }}
        >
          Send to client
        </Button>
      ) : null}

      {canDecideEstimate(estimate.status) ? (
        <>
          <Button
            type="button"
            variant="primary"
            disabled={!canEdit}
            leadingIcon={<CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
            onClick={() => {
              setPrompt('approve');
            }}
          >
            Mark as accepted
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canEdit}
            leadingIcon={<ThumbsDown aria-hidden="true" className="h-4 w-4" />}
            onClick={() => {
              setPrompt('decline');
            }}
          >
            Mark as declined
          </Button>
        </>
      ) : null}

      {canConvertEstimate(estimate.status) ? (
        <Button
          type="button"
          isLoading={isWorking}
          loadingLabel="Creating"
          disabled={!canCreateInvoice}
          leadingIcon={<FileText aria-hidden="true" className="h-4 w-4" />}
          onClick={() => {
            void handleConvert();
          }}
        >
          Create invoice
        </Button>
      ) : null}

      {estimate.status !== 'draft' && canCancelEstimate(estimate.status) ? (
        <Button
          type="button"
          variant="destructive"
          disabled={!canEdit}
          leadingIcon={<Ban aria-hidden="true" className="h-4 w-4" />}
          onClick={() => {
            setPrompt('withdraw');
          }}
        >
          Withdraw estimate
        </Button>
      ) : null}

      <Modal
        isOpen={prompt !== null}
        onClose={() => {
          setPrompt(null);
          setText('');
        }}
        title={
          isApproval
            ? 'Record the client acceptance'
            : prompt === 'decline'
              ? 'Mark as declined?'
              : 'Withdraw this estimate?'
        }
        description={
          isApproval
            ? 'Name the person who accepted, so the record shows who agreed to the price.'
            : prompt === 'decline'
              ? 'Record why the client turned it down so the sales history explains itself.'
              : 'The client will no longer be able to accept it.'
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPrompt(null);
                setText('');
              }}
            >
              Go back
            </Button>
            <Button
              type="button"
              variant={isApproval ? 'primary' : 'destructive'}
              isLoading={isWorking}
              loadingLabel="Saving"
              disabled={!isReady}
              onClick={() => {
                void confirmPrompt();
              }}
            >
              {isApproval
                ? 'Record acceptance'
                : prompt === 'decline'
                  ? 'Mark as declined'
                  : 'Withdraw estimate'}
            </Button>
          </>
        }
      >
        <label className="text-sm font-medium text-foreground" htmlFor="estimate-decision-text">
          {isApproval ? 'Accepted by' : 'Reason'}
        </label>
        <Input
          id="estimate-decision-text"
          className="mt-1"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
      </Modal>
    </div>
  );
}
