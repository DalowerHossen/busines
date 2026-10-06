// src/components/recurring/schedule-actions-bar.tsx
// The buttons across the top of one schedule: start it, hold it, bill early
// or stop it.

'use client';

import { Pause, PenLine, Play, Square, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { runScheduleNow } from '@/features/recurring/actions/run-schedule-now';
import { setScheduleStatus } from '@/features/recurring/actions/set-schedule-status';
import {
  canActivateSchedule,
  canPauseSchedule,
  canRunScheduleNow,
  canStopSchedule,
  isEditableSchedule,
} from '@/features/recurring/status';
import type { ScheduleDetail } from '@/features/recurring/types';
import { cn } from '@/lib/utils';

export interface ScheduleActionsBarProps {
  /** Schedule being looked at. */
  schedule: ScheduleDetail;
  /** False when the signed in account may only read. */
  canEdit: boolean;
  /** False when the signed in account may not raise invoices. */
  canCreateInvoice: boolean;
}

/**
 * Renders the action bar above one recurring schedule.
 *
 * @param props The schedule and what the account is allowed to do.
 * @returns The rendered bar.
 */
export function ScheduleActionsBar({
  schedule,
  canEdit,
  canCreateInvoice,
}: ScheduleActionsBarProps) {
  const router = useRouter();
  const [isStopOpen, setIsStopOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  /**
   * Moves the schedule into another state.
   *
   * @param status State to move to.
   * @param message What to tell the person afterwards.
   * @returns Nothing.
   */
  async function changeStatus(
    status: 'active' | 'paused' | 'cancelled',
    message: string
  ): Promise<void> {
    setIsWorking(true);
    const result = await setScheduleStatus({ scheduleId: schedule.id, status });
    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    setIsStopOpen(false);
    notify.success(message);
    router.refresh();
  }

  /**
   * Produces the next invoice straight away.
   *
   * @returns Nothing.
   */
  async function handleRunNow(): Promise<void> {
    setIsWorking(true);
    const result = await runScheduleNow({ scheduleId: schedule.id });
    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    if (result.data.invoiceId === null) {
      notify.success('This schedule has reached its last invoice.');
      router.refresh();
      return;
    }

    notify.success('Invoice produced from this schedule.');
    router.push(`${ROUTES.invoices}/${result.data.invoiceId}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isEditableSchedule(schedule.status) && canEdit ? (
        <Link
          href={`${ROUTES.subscriptions}/${schedule.id}/edit`}
          className={cn(buttonVariants({ variant: 'secondary' }))}
        >
          <PenLine aria-hidden="true" className="mr-2 h-4 w-4" />
          Edit schedule
        </Link>
      ) : null}

      {canRunScheduleNow(schedule.status) ? (
        <Button
          type="button"
          variant="secondary"
          disabled={!canCreateInvoice || isWorking}
          leadingIcon={<Zap aria-hidden="true" className="h-4 w-4" />}
          onClick={() => {
            void handleRunNow();
          }}
        >
          Bill now
        </Button>
      ) : null}

      {canPauseSchedule(schedule.status) ? (
        <Button
          type="button"
          variant="secondary"
          disabled={!canEdit || isWorking}
          leadingIcon={<Pause aria-hidden="true" className="h-4 w-4" />}
          onClick={() => {
            void changeStatus('paused', 'Schedule is on hold.');
          }}
        >
          Put on hold
        </Button>
      ) : null}

      {canActivateSchedule(schedule.status) ? (
        <Button
          type="button"
          variant="primary"
          disabled={!canEdit || isWorking}
          leadingIcon={<Play aria-hidden="true" className="h-4 w-4" />}
          onClick={() => {
            void changeStatus('active', 'Schedule is running.');
          }}
        >
          {schedule.status === 'paused' ? 'Resume schedule' : 'Start schedule'}
        </Button>
      ) : null}

      {canStopSchedule(schedule.status) ? (
        <Button
          type="button"
          variant="ghost"
          disabled={!canEdit || isWorking}
          leadingIcon={<Square aria-hidden="true" className="h-4 w-4" />}
          onClick={() => {
            setIsStopOpen(true);
          }}
        >
          Stop for good
        </Button>
      ) : null}

      <Modal
        isOpen={isStopOpen}
        onClose={() => {
          setIsStopOpen(false);
        }}
        title="Stop this schedule?"
        description="No further invoices are produced. Everything already billed stays exactly as it is."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsStopOpen(false);
              }}
            >
              Keep it running
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={isWorking}
              loadingLabel="Stopping"
              onClick={() => {
                void changeStatus('cancelled', 'Schedule stopped.');
              }}
            >
              Stop schedule
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          If you only want a break, put the schedule on hold instead. A stopped schedule cannot be
          started again.
        </p>
      </Modal>
    </div>
  );
}
