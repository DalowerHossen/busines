// src/components/estimates/estimate-row-actions.tsx
// The menu at the end of each estimate row. What is offered depends on the
// state of the quotation: a draft can be edited, sent or deleted, one with the
// client can be marked accepted or declined, and an accepted one can become an
// invoice.

'use client';

import {
  Ban,
  CheckCircle2,
  FileText,
  MoreHorizontal,
  PenLine,
  RotateCcw,
  Send,
  ThumbsDown,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, type DropdownItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { approveEstimate } from '@/features/estimates/actions/approve-estimate';
import { cancelEstimate } from '@/features/estimates/actions/cancel-estimate';
import { convertEstimate } from '@/features/estimates/actions/convert-estimate';
import { declineEstimate } from '@/features/estimates/actions/decline-estimate';
import { deleteEstimate } from '@/features/estimates/actions/delete-estimate';
import { restoreEstimate } from '@/features/estimates/actions/restore-estimate';
import { sendEstimate } from '@/features/estimates/actions/send-estimate';
import {
  canCancelEstimate,
  canConvertEstimate,
  canDecideEstimate,
  isEditableEstimate,
} from '@/features/estimates/status';
import type { EstimateSummary } from '@/features/estimates/types';

export interface EstimateRowActionsProps {
  /** Estimate the menu belongs to. */
  estimate: EstimateSummary;
  /** False when the signed in account may only read. */
  canEdit: boolean;
  /** False when the signed in account may not delete. */
  canDelete: boolean;
}

type TextPrompt = 'decline' | 'withdraw' | null;

/**
 * Renders the row menu for one estimate.
 *
 * @param props The estimate and what the account is allowed to do.
 * @returns The rendered menu.
 */
export function EstimateRowActions({ estimate, canEdit, canDelete }: EstimateRowActionsProps) {
  const router = useRouter();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [prompt, setPrompt] = useState<TextPrompt>(null);
  const [reason, setReason] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const isDraft = isEditableEstimate(estimate.status);

  /**
   * Sends the quotation and reports the number it was given.
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
   * Records that the client accepted the quotation.
   *
   * @returns Nothing.
   */
  async function handleApprove(): Promise<void> {
    setIsWorking(true);
    const result = await approveEstimate({ estimateId: estimate.id, approvedByName: '' });
    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    notify.success('Marked as accepted by the client.');
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
   * Deletes the draft after the question has been answered.
   *
   * @returns Nothing.
   */
  async function confirmDelete(): Promise<void> {
    setIsWorking(true);
    const result = await deleteEstimate({ estimateId: estimate.id });
    setIsWorking(false);
    setIsDeleteOpen(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    notify.success('Draft deleted. You can restore it from the deleted list.');
    router.refresh();
  }

  /**
   * Records a decline or a withdrawal with the reason given.
   *
   * @returns Nothing.
   */
  async function confirmReason(): Promise<void> {
    if (prompt === null) {
      return;
    }

    setIsWorking(true);
    const result =
      prompt === 'decline'
        ? await declineEstimate({ estimateId: estimate.id, reason })
        : await cancelEstimate({ estimateId: estimate.id, reason });
    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    setPrompt(null);
    setReason('');
    notify.success(prompt === 'decline' ? 'Marked as declined.' : 'Estimate withdrawn.');
    router.refresh();
  }

  /**
   * Brings a deleted draft back.
   *
   * @returns Nothing.
   */
  async function handleRestore(): Promise<void> {
    setIsWorking(true);
    const result = await restoreEstimate({ estimateId: estimate.id });
    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    notify.success('Estimate restored.');
    router.refresh();
  }

  const items: DropdownItem[] = [
    {
      key: 'open',
      label: 'Open estimate',
      icon: FileText,
      onSelect: () => {
        router.push(`${ROUTES.estimates}/${estimate.id}`);
      },
    },
  ];

  if (estimate.isDeleted) {
    items.push({
      key: 'restore',
      label: 'Restore estimate',
      icon: RotateCcw,
      isDisabled: !canDelete || isWorking,
      onSelect: () => {
        void handleRestore();
      },
    });

    return (
      <DropdownMenu
        align="end"
        triggerLabel={`Actions for ${estimate.estimateNumber ?? 'this draft estimate'}`}
        items={items}
        trigger={
          <Button type="button" variant="ghost" size="icon">
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          </Button>
        }
      />
    );
  }

  if (isDraft) {
    items.push(
      {
        key: 'edit',
        label: 'Edit draft',
        icon: PenLine,
        isDisabled: !canEdit || isWorking,
        onSelect: () => {
          router.push(`${ROUTES.estimates}/${estimate.id}/edit`);
        },
      },
      {
        key: 'send',
        label: 'Send to client',
        icon: Send,
        isDisabled: !canEdit || isWorking,
        onSelect: () => {
          void handleSend();
        },
      },
      {
        key: 'delete',
        label: 'Delete draft',
        icon: Trash2,
        isDestructive: true,
        isDisabled: !canDelete || isWorking,
        onSelect: () => {
          setIsDeleteOpen(true);
        },
      }
    );
  }

  if (canDecideEstimate(estimate.status)) {
    items.push(
      {
        key: 'approve',
        label: 'Mark as accepted',
        icon: CheckCircle2,
        isDisabled: !canEdit || isWorking,
        onSelect: () => {
          void handleApprove();
        },
      },
      {
        key: 'decline',
        label: 'Mark as declined',
        icon: ThumbsDown,
        isDisabled: !canEdit || isWorking,
        onSelect: () => {
          setPrompt('decline');
        },
      }
    );
  }

  if (canConvertEstimate(estimate.status)) {
    items.push({
      key: 'convert',
      label: 'Create invoice',
      icon: FileText,
      isDisabled: !canEdit || isWorking,
      onSelect: () => {
        void handleConvert();
      },
    });
  }

  if (!isDraft && canCancelEstimate(estimate.status)) {
    items.push({
      key: 'withdraw',
      label: 'Withdraw estimate',
      icon: Ban,
      isDestructive: true,
      isDisabled: !canEdit || isWorking,
      onSelect: () => {
        setPrompt('withdraw');
      },
    });
  }

  return (
    <>
      <DropdownMenu
        align="end"
        triggerLabel={`Actions for ${estimate.estimateNumber ?? 'this draft estimate'}`}
        items={items}
        trigger={
          <Button type="button" variant="ghost" size="icon">
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          </Button>
        }
      />

      <Modal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
        }}
        title="Delete this draft?"
        description="It has not gone out, so nothing the client holds changes."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsDeleteOpen(false);
              }}
            >
              Keep draft
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={isWorking}
              loadingLabel="Deleting"
              onClick={() => {
                void confirmDelete();
              }}
            >
              Delete draft
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Deleted drafts stay in the deleted list, so this can be undone.
        </p>
      </Modal>

      <Modal
        isOpen={prompt !== null}
        onClose={() => {
          setPrompt(null);
          setReason('');
        }}
        title={prompt === 'decline' ? 'Mark as declined?' : 'Withdraw this estimate?'}
        description={
          prompt === 'decline'
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
                setReason('');
              }}
            >
              Go back
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={isWorking}
              loadingLabel="Saving"
              disabled={reason.trim().length < 3}
              onClick={() => {
                void confirmReason();
              }}
            >
              {prompt === 'decline' ? 'Mark as declined' : 'Withdraw estimate'}
            </Button>
          </>
        }
      >
        <label className="text-sm font-medium text-foreground" htmlFor="estimate-reason">
          Reason
        </label>
        <Input
          id="estimate-reason"
          className="mt-1"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
      </Modal>
    </>
  );
}
