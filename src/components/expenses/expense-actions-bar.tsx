// src/components/expenses/expense-actions-bar.tsx
// The buttons across the top of one claim: submit it, approve it, send it
// back or record that it has been paid.

'use client';

import { Check, PenLine, Send, Undo2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { reviewExpense } from '@/features/expenses/actions/review-expense';
import { settleExpense } from '@/features/expenses/actions/settle-expense';
import { submitExpense } from '@/features/expenses/actions/submit-expense';
import {
  canReviewExpense,
  canSettleExpense,
  canSubmitExpense,
  isEditableExpense,
} from '@/features/expenses/status';
import type { ExpenseDetail } from '@/features/expenses/types';
import { todayIso } from '@/lib/dates';
import { cn } from '@/lib/utils';

export interface ExpenseActionsBarProps {
  /** Claim being looked at. */
  expense: ExpenseDetail;
  /** False when the signed in account may only read. */
  canEdit: boolean;
  /** False when the signed in account may not approve spending. */
  canApprove: boolean;
}

type OpenDialog = 'none' | 'reject' | 'settle';

/**
 * Renders the action bar above one expense claim.
 *
 * @param props The claim and what the account is allowed to do.
 * @returns The rendered bar.
 */
export function ExpenseActionsBar({ expense, canEdit, canApprove }: ExpenseActionsBarProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<OpenDialog>('none');
  const [reason, setReason] = useState('');
  const [paidOn, setPaidOn] = useState(todayIso());
  const [isWorking, setIsWorking] = useState(false);

  /**
   * Shows the outcome of an action and refreshes the page.
   *
   * @param ok True when the action succeeded.
   * @param message What to tell the person.
   * @returns Nothing.
   */
  function finish(ok: boolean, message: string): void {
    setIsWorking(false);

    if (!ok) {
      notify.error(message);
      return;
    }

    setDialog('none');
    notify.success(message);
    router.refresh();
  }

  /**
   * Sends the claim for approval.
   *
   * @returns Nothing.
   */
  async function handleSubmitForApproval(): Promise<void> {
    setIsWorking(true);
    const result = await submitExpense({ expenseId: expense.id });
    finish(result.success, result.success ? 'Claim sent for approval.' : result.error);
  }

  /**
   * Approves the claim.
   *
   * @returns Nothing.
   */
  async function handleApprove(): Promise<void> {
    setIsWorking(true);
    const result = await reviewExpense({ expenseId: expense.id, approve: true, reason: '' });
    finish(result.success, result.success ? 'Claim approved.' : result.error);
  }

  /**
   * Sends the claim back with a reason.
   *
   * @returns Nothing.
   */
  async function handleReject(): Promise<void> {
    setIsWorking(true);
    const result = await reviewExpense({ expenseId: expense.id, approve: false, reason });
    finish(result.success, result.success ? 'Claim sent back.' : result.error);
  }

  /**
   * Records that the claim has been paid.
   *
   * @returns Nothing.
   */
  async function handleSettle(): Promise<void> {
    setIsWorking(true);
    const result = await settleExpense({ expenseId: expense.id, paidOn, paymentMethod: '' });
    finish(result.success, result.success ? 'Marked as paid.' : result.error);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isEditableExpense(expense.status) && canEdit && !expense.isDeleted ? (
        <Link
          href={`${ROUTES.expenses}/${expense.id}/edit`}
          className={cn(buttonVariants({ variant: 'secondary' }))}
        >
          <PenLine aria-hidden="true" className="mr-2 h-4 w-4" />
          Edit expense
        </Link>
      ) : null}

      {canSubmitExpense(expense.status) ? (
        <Button
          type="button"
          variant="primary"
          disabled={!canEdit || isWorking}
          leadingIcon={<Send aria-hidden="true" className="h-4 w-4" />}
          onClick={() => {
            void handleSubmitForApproval();
          }}
        >
          Send for approval
        </Button>
      ) : null}

      {canReviewExpense(expense.status) ? (
        <>
          <Button
            type="button"
            variant="primary"
            disabled={!canApprove || isWorking}
            leadingIcon={<Check aria-hidden="true" className="h-4 w-4" />}
            onClick={() => {
              void handleApprove();
            }}
          >
            Approve
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!canApprove || isWorking}
            leadingIcon={<Undo2 aria-hidden="true" className="h-4 w-4" />}
            onClick={() => {
              setDialog('reject');
            }}
          >
            Send back
          </Button>
        </>
      ) : null}

      {canSettleExpense(expense.status, expense.isPaid) ? (
        <Button
          type="button"
          variant="secondary"
          disabled={!canEdit || isWorking}
          leadingIcon={<Wallet aria-hidden="true" className="h-4 w-4" />}
          onClick={() => {
            setDialog('settle');
          }}
        >
          Mark as paid
        </Button>
      ) : null}

      <Modal
        isOpen={dialog === 'reject'}
        onClose={() => {
          setDialog('none');
        }}
        title="Send this claim back?"
        description="The person who claimed it can correct the figures and submit it again."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDialog('none');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={isWorking}
              loadingLabel="Sending back"
              onClick={() => {
                void handleReject();
              }}
            >
              Send back
            </Button>
          </>
        }
      >
        <FormField id="detail-reject-reason" label="Reason" isRequired>
          <Textarea
            {...fieldAccessibilityProps('detail-reject-reason', false, false)}
            rows={3}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
        </FormField>
      </Modal>

      <Modal
        isOpen={dialog === 'settle'}
        onClose={() => {
          setDialog('none');
        }}
        title="Mark this claim as paid"
        description="Record the day the money actually left the account."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDialog('none');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              isLoading={isWorking}
              loadingLabel="Saving"
              onClick={() => {
                void handleSettle();
              }}
            >
              Mark as paid
            </Button>
          </>
        }
      >
        <FormField id="detail-settle-date" label="Paid on">
          <Input
            {...fieldAccessibilityProps('detail-settle-date', false, false)}
            type="date"
            value={paidOn}
            onChange={(event) => {
              setPaidOn(event.target.value);
            }}
          />
        </FormField>
      </Modal>
    </div>
  );
}
