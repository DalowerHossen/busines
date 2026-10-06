// src/components/onboarding/setup-checklist.tsx
// The path from signing up to being paid, in order.
//
// A new seller does not want a tour, they want to know the shortest route to
// money arriving. Five steps are required and they are listed first; the
// rest are suggestions that can be hidden. Every step links straight to the
// page that finishes it, so nothing here is a dead end.

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { notify } from '@/components/ui/toaster';
import { activateCompany } from '@/features/onboarding/actions/activate-company';
import { dismissOnboardingTask } from '@/features/onboarding/actions/dismiss-task';
import type { OnboardingState, OnboardingTask } from '@/features/onboarding/types';
import { formatNumber } from '@/lib/format';

export interface SetupChecklistProps {
  /** How far this seller has got. */
  state: OnboardingState;
  /** True when the viewer may act on the steps. */
  canAct: boolean;
}

/**
 * Renders one step of the setup.
 *
 * @param props The step, whether it can be hidden, and the hide handler.
 * @returns The rendered row.
 */
function TaskRow({
  task,
  canAct,
  onHide,
}: {
  task: OnboardingTask;
  canAct: boolean;
  onHide: (key: string) => void;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-4">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden="true"
            className={
              task.isDone
                ? 'inline-flex h-6 w-6 items-center justify-center rounded-full bg-success-subtle text-xs font-semibold'
                : 'inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs'
            }
          >
            {task.isDone ? '1' : ''}
          </span>
          <p className="font-medium text-foreground">{task.title}</p>
          {task.isRequired ? (
            <Badge tone={task.isDone ? 'success' : 'warning'}>
              {task.isDone ? 'Done' : 'Needed to get paid'}
            </Badge>
          ) : (
            <Badge tone="neutral">{task.isDone ? 'Done' : 'Suggested'}</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{task.description}</p>
      </div>

      <div className="flex items-center gap-2">
        {task.isDone ? null : (
          <Link
            href={task.href}
            className="inline-flex min-h-touch items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-xs"
          >
            Finish this
          </Link>
        )}

        {canAct && !task.isRequired && !task.isDone ? (
          <Button variant="ghost" onClick={() => onHide(task.key)}>
            Not now
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Renders the setup checklist.
 *
 * @param props The setup state and whether the viewer may act.
 * @returns The rendered checklist.
 */
export function SetupChecklist({ state, canAct }: SetupChecklistProps) {
  const router = useRouter();
  const [isWorking, setIsWorking] = useState(false);

  const required = state.tasks.filter((task) => task.isRequired);
  const optional = state.tasks.filter((task) => task.isRequired === false && !task.isDismissed);
  const remaining = state.requiredCount - state.requiredDone;

  /**
   * Hides one suggestion.
   *
   * @param key Step being hidden.
   * @returns Nothing.
   */
  async function onHide(key: string): Promise<void> {
    const result = await dismissOnboardingTask({ taskKey: key });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    router.refresh();
  }

  /**
   * Moves the account out of setting up.
   *
   * @returns Nothing.
   */
  async function onFinish(): Promise<void> {
    setIsWorking(true);
    const result = await activateCompany({});
    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Your account is open for business.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {state.isReadyToTrade
              ? 'You are ready to be paid'
              : `${formatNumber(remaining)} ${remaining === 1 ? 'step' : 'steps'} until you can be paid`}
          </CardTitle>
          <CardDescription>
            {state.isReadyToTrade
              ? 'Everything needed to collect money from a client is in place. Anything below is a suggestion, not a requirement.'
              : 'Your client pays by card, the money is held for a short period, and then you withdraw it. These are the steps that make that possible.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-brand-600"
              style={{
                width: `${
                  state.requiredCount === 0
                    ? 0
                    : Math.round((state.requiredDone / state.requiredCount) * 100)
                }%`,
              }}
            />
          </div>
          <p className="tabular text-sm text-muted-foreground">
            {`${formatNumber(state.requiredDone)} of ${formatNumber(state.requiredCount)} required steps done`}
          </p>

          {state.isReadyToTrade && state.status === 'onboarding' && canAct ? (
            <Button isLoading={isWorking} loadingLabel="Finishing" onClick={() => void onFinish()}>
              Open my account for business
            </Button>
          ) : null}

          {state.hasFirstPayment ? (
            <Alert tone="success" title="Your first payment has arrived">
              It is held for a short period, then it becomes available to withdraw. The exact terms
              are shown on your payouts page.
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Before you can be paid</h2>
        <ul className="space-y-3">
          {required.map((task) => (
            <TaskRow
              key={task.key}
              task={task}
              canAct={canAct}
              onHide={(key) => void onHide(key)}
            />
          ))}
        </ul>
      </section>

      {optional.length === 0 ? null : (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Worth doing next</h2>
          <ul className="space-y-3">
            {optional.map((task) => (
              <TaskRow
                key={task.key}
                task={task}
                canAct={canAct}
                onHide={(key) => void onHide(key)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
