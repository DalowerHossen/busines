// src/components/invoices/invoice-actions-bar.tsx
// The actions offered on the page of one invoice: edit or issue a draft, or
// cancel an invoice that has already gone out.

'use client';

import { Ban, Printer, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { notify } from '@/components/ui/toaster';
import { cancelInvoice } from '@/features/invoices/actions/cancel-invoice';
import { issueInvoice } from '@/features/invoices/actions/issue-invoice';
import { canCancelInvoice, canIssueInvoice } from '@/features/invoices/status';
import type { InvoiceDetail } from '@/features/invoices/types';

export interface InvoiceActionsBarProps {
  /** Invoice the actions apply to. */
  invoice: InvoiceDetail;
  /** False when the signed in account may only read. */
  canEdit: boolean;
}

/**
 * Renders the action buttons on the invoice page.
 *
 * @param props The invoice and what the account may do.
 * @returns The rendered buttons.
 */
export function InvoiceActionsBar({ invoice, canEdit }: InvoiceActionsBarProps) {
  const router = useRouter();
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  /**
   * Issues the draft.
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
   * Cancels the invoice with the reason given.
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

      {canIssueInvoice(invoice.status, invoice.isLocked, invoice.lines.length) ? (
        <Button
          type="button"
          isLoading={isWorking}
          loadingLabel="Issuing"
          disabled={!canEdit}
          leadingIcon={<Send aria-hidden="true" className="h-4 w-4" />}
          onClick={() => {
            void handleIssue();
          }}
        >
          Issue invoice
        </Button>
      ) : null}

      {canCancelInvoice(invoice.status) ? (
        <Button
          type="button"
          variant="destructive"
          disabled={!canEdit}
          leadingIcon={<Ban aria-hidden="true" className="h-4 w-4" />}
          onClick={() => {
            setIsCancelOpen(true);
          }}
        >
          Cancel invoice
        </Button>
      ) : null}

      <Modal
        isOpen={isCancelOpen}
        onClose={() => {
          setIsCancelOpen(false);
        }}
        title="Cancel this invoice?"
        description="The invoice keeps its number and stays on record, marked as cancelled, so your numbering and your audit trail stay complete."
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
        <label className="text-sm font-medium text-foreground" htmlFor="invoice-cancel-reason">
          Reason
        </label>
        <Input
          id="invoice-cancel-reason"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
      </Modal>
    </div>
  );
}
