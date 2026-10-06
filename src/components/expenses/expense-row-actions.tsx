// src/components/expenses/expense-row-actions.tsx
// The menu at the end of each expense row: send it for approval, approve it,
// send it back, mark it paid or take it off the list.

'use client';

import {
  Check,
  MoreHorizontal,
  PenLine,
  Receipt,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
  Wallet,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, type DropdownItem } from '@/components/ui/dropdown-menu';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { deleteExpense } from '@/features/expenses/actions/delete-expense';
import { restoreExpense } from '@/features/expenses/actions/restore-expense';
import { reviewExpense } from '@/features/expenses/actions/review-expense';
import { settleExpense } from '@/features/expenses/actions/settle-expense';
import { submitExpense } from '@/features/expenses/actions/submit-expense';
import {
  canReviewExpense,
  canSettleExpense,
  canSubmitExpense,
  isEditableExpense,
} from '@/features/expenses/status';
import type { ExpenseSummary } from '@/features/expenses/types';
import { todayIso } from '@/lib/dates';

export interface ExpenseRowActionsProps {
  /** Claim the menu belongs to. */
  expense: ExpenseSummary;
  /** False when the signed in account may only read. */
  canEdit: boolean;
  /** False when the signed in account may not approve spending. */
  canApprove: boolean;
  /** False when the signed in account may not delete. */
  canDelete: boolean;
}

type OpenDialog = 'none' | 'reject' | 'settle' | 'delete';

/**
 * Renders the row menu for one expense claim.
 *
 * @param props The claim and what the account is allowed to do.
 * @returns The rendered menu.
 */
export function ExpenseRowActions({
  expense,
  canEdit,
  canApprove,
  canDelete,
}: ExpenseRowActionsProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<OpenDialog>('none');
  const [reason, setReason] = useState('');
  const [paidOn, setPaidOn] = useState(todayIso());
  const [isWorking, setIsWorking] = useState(false);

  /**
   * Shows the outcome of an action and refreshes the list.
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

  /**
   * Deletes the claim.
   *
   * @returns Nothing.
   */
  async function handleDelete(): Promise<void> {
    setIsWorking(true);
    const result = await deleteExpense({ expenseId: expense.id });
    finish(result.success, result.success ? 'Expense deleted.' : result.error);
  }

  /**
   * Brings a deleted claim back.
   *
   * @returns Nothing.
   */
  async function handleRestore(): Promise<void> {
    setIsWorking(true);
    const result = await restoreExpense({ expenseId: expense.id });
    finish(result.success, result.success ? 'Expense restored.' : result.error);
  }

  const items: DropdownItem[] = [
    {
      key: 'open',
      label: 'Open expense',
      icon: Receipt,
      onSelect: () => {
        router.push(`${ROUTES.expenses}/${expense.id}`);
      },
    },
  ];

  if (expense.isDeleted) {
    items.push({
      key: 'restore',
      label: 'Restore expense',
      icon: RotateCcw,
      isDisabled: !canDelete || isWorking,
      onSelect: () => {
        void handleRestore();
      },
    });
  } else {
    if (isEditableExpense(expense.status)) {
      items.push({
        key: 'edit',
        label: 'Edit expense',
        icon: PenLine,
        isDisabled: !canEdit || isWorking,
        onSelect: () => {
          router.push(`${ROUTES.expenses}/${expense.id}/edit`);
        },
      });
    }

    if (canSubmitExpense(expense.status)) {
      items.push({
        key: 'submit',
        label: 'Send for approval',
        icon: Send,
        isDisabled: !canEdit || isWorking,
        onSelect: () => {
          void handleSubmitForApproval();
        },
      });
    }

    if (canReviewExpense(expense.status)) {
      items.push(
        {
          key: 'approve',
          label: 'Approve claim',
          icon: Check,
          isDisabled: !canApprove || isWorking,
          onSelect: () => {
            void handleApprove();
          },
        },
        {
          key: 'reject',
          label: 'Send back',
          icon: Undo2,
          isDisabled: !canApprove || isWorking,
          onSelect: () => {
            setDialog('reject');
          },
        }
      );
    }

    if (canSettleExpense(expense.status, expense.isPaid)) {
      items.push({
        key: 'settle',
        label: 'Mark as paid',
        icon: Wallet,
        isDisabled: !canEdit || isWorking,
        onSelect: () => {
          setDialog('settle');
        },
      });
    }

    items.push({
      key: 'delete',
      label: 'Delete expense',
      icon: Trash2,
      isDestructive: true,
      isDisabled: !canDelete || isWorking,
      onSelect: () => {
        setDialog('delete');
      },
    });
  }

  return (
    <>
      <DropdownMenu
        align="end"
        triggerLabel={`Actions for ${expense.expenseNumber}`}
        items={items}
        trigger={
          <Button type="button" variant="ghost" size="icon">
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          </Button>
        }
      />

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
        <FormField id="reject-reason" label="Reason" isRequired>
          <Textarea
            {...fieldAccessibilityProps('reject-reason', false, false)}
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
        <FormField id="settle-date" label="Paid on">
          <Input
            {...fieldAccessibilityProps('settle-date', false, false)}
            type="date"
            value={paidOn}
            onChange={(event) => {
              setPaidOn(event.target.value);
            }}
          />
        </FormField>
      </Modal>

      <Modal
        isOpen={dialog === 'delete'}
        onClose={() => {
          setDialog('none');
        }}
        title="Delete this expense?"
        description="It leaves your working lists but stays in the deleted list."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDialog('none');
              }}
            >
              Keep expense
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={isWorking}
              loadingLabel="Deleting"
              onClick={() => {
                void handleDelete();
              }}
            >
              Delete expense
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          A claim that has been paid or recharged to a client cannot be deleted.
        </p>
      </Modal>
    </>
  );
}
