// src/components/recurring/schedule-row-actions.tsx
// The menu at the end of each schedule row: start it, hold it, bill early,
// stop it for good, or take it out of the list.

'use client';

import {
  CalendarClock,
  MoreHorizontal,
  Pause,
  PenLine,
  Play,
  RotateCcw,
  Square,
  Trash2,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, type DropdownItem } from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/ui/modal';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { deleteSchedule } from '@/features/recurring/actions/delete-schedule';
import { restoreSchedule } from '@/features/recurring/actions/restore-schedule';
import { runScheduleNow } from '@/features/recurring/actions/run-schedule-now';
import { setScheduleStatus } from '@/features/recurring/actions/set-schedule-status';
import {
  canActivateSchedule,
  canPauseSchedule,
  canRunScheduleNow,
  canStopSchedule,
  isEditableSchedule,
} from '@/features/recurring/status';
import type { ScheduleSummary } from '@/features/recurring/types';

export interface ScheduleRowActionsProps {
  /** Schedule the menu belongs to. */
  schedule: ScheduleSummary;
  /** False when the signed in account may only read. */
  canEdit: boolean;
  /** False when the signed in account may not delete. */
  canDelete: boolean;
}

/**
 * Renders the row menu for one recurring schedule.
 *
 * @param props The schedule and what the account is allowed to do.
 * @returns The rendered menu.
 */
export function ScheduleRowActions({ schedule, canEdit, canDelete }: ScheduleRowActionsProps) {
  const router = useRouter();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
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

  /**
   * Deletes the schedule after the question has been answered.
   *
   * @returns Nothing.
   */
  async function confirmDelete(): Promise<void> {
    setIsWorking(true);
    const result = await deleteSchedule({ scheduleId: schedule.id });
    setIsWorking(false);
    setIsDeleteOpen(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    notify.success('Schedule deleted. Every invoice it produced stays on record.');
    router.refresh();
  }

  /**
   * Brings a deleted schedule back, on hold.
   *
   * @returns Nothing.
   */
  async function handleRestore(): Promise<void> {
    setIsWorking(true);
    const result = await restoreSchedule({ scheduleId: schedule.id });
    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    notify.success('Schedule restored and left on hold.');
    router.refresh();
  }

  const items: DropdownItem[] = [
    {
      key: 'open',
      label: 'Open schedule',
      icon: CalendarClock,
      onSelect: () => {
        router.push(`${ROUTES.subscriptions}/${schedule.id}`);
      },
    },
  ];

  if (schedule.isDeleted) {
    items.push({
      key: 'restore',
      label: 'Restore schedule',
      icon: RotateCcw,
      isDisabled: !canDelete || isWorking,
      onSelect: () => {
        void handleRestore();
      },
    });
  } else {
    if (isEditableSchedule(schedule.status)) {
      items.push({
        key: 'edit',
        label: 'Edit schedule',
        icon: PenLine,
        isDisabled: !canEdit || isWorking,
        onSelect: () => {
          router.push(`${ROUTES.subscriptions}/${schedule.id}/edit`);
        },
      });
    }

    if (canActivateSchedule(schedule.status)) {
      items.push({
        key: 'start',
        label: schedule.status === 'paused' ? 'Resume schedule' : 'Start schedule',
        icon: Play,
        isDisabled: !canEdit || isWorking,
        onSelect: () => {
          void changeStatus('active', 'Schedule is running.');
        },
      });
    }

    if (canPauseSchedule(schedule.status)) {
      items.push({
        key: 'pause',
        label: 'Put on hold',
        icon: Pause,
        isDisabled: !canEdit || isWorking,
        onSelect: () => {
          void changeStatus('paused', 'Schedule is on hold.');
        },
      });
    }

    if (canRunScheduleNow(schedule.status)) {
      items.push({
        key: 'run',
        label: 'Bill now',
        icon: Zap,
        isDisabled: !canEdit || isWorking,
        onSelect: () => {
          void handleRunNow();
        },
      });
    }

    if (canStopSchedule(schedule.status)) {
      items.push({
        key: 'stop',
        label: 'Stop for good',
        icon: Square,
        isDestructive: true,
        isDisabled: !canEdit || isWorking,
        onSelect: () => {
          setIsStopOpen(true);
        },
      });
    }

    items.push({
      key: 'delete',
      label: 'Delete schedule',
      icon: Trash2,
      isDestructive: true,
      isDisabled: !canDelete || isWorking,
      onSelect: () => {
        setIsDeleteOpen(true);
      },
    });
  }

  return (
    <>
      <DropdownMenu
        align="end"
        triggerLabel={`Actions for ${schedule.name}`}
        items={items}
        trigger={
          <Button type="button" variant="ghost" size="icon">
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          </Button>
        }
      />

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

      <Modal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
        }}
        title="Delete this schedule?"
        description="It leaves your working lists and stops producing invoices."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsDeleteOpen(false);
              }}
            >
              Keep schedule
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
              Delete schedule
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Deleted schedules stay in the deleted list, so this can be undone.
        </p>
      </Modal>
    </>
  );
}
