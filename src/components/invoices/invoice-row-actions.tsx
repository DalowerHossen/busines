// src/components/invoices/invoice-row-actions.tsx
// The menu at the end of each invoice row. What is offered depends on the
// state of the document: a draft can be edited, issued or deleted, while an
// issued invoice can only be cancelled.

'use client';

import { Ban, FileText, MoreHorizontal, PenLine, RotateCcw, Send, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, type DropdownItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { cancelInvoice } from '@/features/invoices/actions/cancel-invoice';
import { deleteInvoice } from '@/features/invoices/actions/delete-invoice';
import { issueInvoice } from '@/features/invoices/actions/issue-invoice';
import { restoreInvoice } from '@/features/invoices/actions/restore-invoice';
import { canCancelInvoice, isEditableInvoice } from '@/features/invoices/status';
import type { InvoiceSummary } from '@/features/invoices/types';

export interface InvoiceRowActionsProps {
  /** Invoice the menu belongs to. */
  invoice: InvoiceSummary;
  /** False when the signed in account may only read. */
  canEdit: boolean;
  /** False when the signed in account may not delete. */
  canDelete: boolean;
}

/**
 * Renders the row menu for one invoice.
 *
 * @param props The invoice and what the account is allowed to do.
 * @returns The rendered menu.
 */
export function InvoiceRowActions({ invoice, canEdit, canDelete }: InvoiceRowActionsProps) {
  const router = useRouter();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const isDraft = isEditableInvoice(invoice.status, invoice.isLocked);

  /**
   * Issues the draft and tells the person what number it was given.
   *
   * @returns Nothing.
   */
  async function handleIssue(): Promise<void> {
    setIsWorking(true);
    const result = await issueInvoice({ invoiceId: invoice.id });
    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    notify.success(`Invoice ${result.data.invoiceNumber} issued.`);
    router.refresh();
  }

  /**
   * Deletes the draft after the question has been answered.
   *
   * @returns Nothing.
   */
  async function confirmDelete(): Promise<void> {
    setIsWorking(true);
    const result = await deleteInvoice({ invoiceId: invoice.id });
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
   * Cancels an issued invoice with the reason given.
   *
   * @returns Nothing.
   */
  async function confirmCancel(): Promise<void> {
    setIsWorking(true);
    const result = await cancelInvoice({ invoiceId: invoice.id, reason });
    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    setIsCancelOpen(false);
    setReason('');
    notify.success('Invoice cancelled.');
    router.refresh();
  }

  /**
   * Brings a deleted draft back.
   *
   * @returns Nothing.
   */
  async function handleRestore(): Promise<void> {
    setIsWorking(true);
    const result = await restoreInvoice({ invoiceId: invoice.id });
    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    notify.success('Draft restored.');
    router.refresh();
  }

  const items: DropdownItem[] = [
    {
      key: 'open',
      label: 'Open invoice',
      icon: FileText,
      onSelect: () => {
        router.push(`${ROUTES.invoices}/${invoice.id}`);
      },
    },
  ];

  if (invoice.isDeleted) {
    items.push({
      key: 'restore',
      label: 'Restore draft',
      icon: RotateCcw,
      isDisabled: !canDelete || isWorking,
      onSelect: () => {
        void handleRestore();
      },
    });
  } else if (isDraft) {
    items.push({
      key: 'edit',
      label: 'Edit draft',
      icon: PenLine,
      isDisabled: !canEdit,
      onSelect: () => {
        router.push(`${ROUTES.invoices}/${invoice.id}/edit`);
      },
    });

    items.push({
      key: 'issue',
      label: 'Issue invoice',
      icon: Send,
      isDisabled: !canEdit || isWorking,
      onSelect: () => {
        void handleIssue();
      },
    });

    items.push({
      key: 'delete',
      label: 'Delete draft',
      icon: Trash2,
      isDestructive: true,
      isDisabled: !canDelete || isWorking,
      onSelect: () => {
        setIsDeleteOpen(true);
      },
    });
  } else if (canCancelInvoice(invoice.status)) {
    items.push({
      key: 'cancel',
      label: 'Cancel invoice',
      icon: Ban,
      isDestructive: true,
      isDisabled: !canEdit || isWorking,
      onSelect: () => {
        setIsCancelOpen(true);
      },
    });
  }

  return (
    <>
      <DropdownMenu
        align="end"
        triggerLabel={`Actions for invoice ${invoice.invoiceNumber ?? 'draft'}`}
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
        description="Nothing has been sent to the client and no number has been used, so the draft can be removed safely."
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
          You can bring the draft back from the deleted view at any time.
        </p>
      </Modal>

      <Modal
        isOpen={isCancelOpen}
        onClose={() => {
          setIsCancelOpen(false);
        }}
        title="Cancel this invoice?"
        description="The invoice stays on record with its number, marked as cancelled, so your numbering and your audit trail stay complete."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsCancelOpen(false);
              }}
            >
              Keep invoice
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={isWorking}
              loadingLabel="Cancelling"
              disabled={reason.trim().length < 3}
              onClick={() => {
                void confirmCancel();
              }}
            >
              Cancel invoice
            </Button>
          </>
        }
      >
        <label className="text-sm font-medium text-foreground" htmlFor="cancel-reason">
          Reason
        </label>
        <Input
          id="cancel-reason"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
        <p className="mt-2 text-sm text-muted-foreground">
          The reason is kept with the document so anyone reviewing the books later can see why.
        </p>
      </Modal>
    </>
  );
}
