// src/components/dashboard/getting-started.tsx
// The short list a new business works through. Each step reports its real
// state from the data, so it ticks itself off as the work is done.

import { Check, Circle } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/config/app';
import { cn } from '@/lib/utils';

export interface GettingStartedStep {
  key: string;
  title: string;
  description: string;
  isDone: boolean;
}

export interface GettingStartedProps {
  /** Steps and whether each one has been completed. */
  steps: readonly GettingStartedStep[];
}

/**
 * Renders the setup checklist.
 *
 * @param props Steps to show.
 * @returns The rendered card, or nothing once every step is done.
 */
export function GettingStarted({ steps }: GettingStartedProps) {
  const remaining = steps.filter((step) => !step.isDone).length;

  if (remaining === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Finish setting up</CardTitle>
        <CardDescription>
          {remaining === 1
            ? 'One step left before this account is fully set up.'
            : `${remaining} steps left before this account is fully set up.`}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ol className="space-y-4">
          {steps.map((step) => (
            <li key={step.key} className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                  step.isDone
                    ? 'border-success bg-success-subtle text-success'
                    : 'border-border text-muted-foreground'
                )}
              >
                {step.isDone ? (
                  <Check aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <Circle aria-hidden="true" className="h-2.5 w-2.5" />
                )}
                <span className="visually-hidden">{step.isDone ? 'Done' : 'Still to do'}</span>
              </span>

              <div className="space-y-0.5">
                <p
                  className={cn(
                    'text-sm font-medium',
                    step.isDone ? 'text-muted-foreground line-through' : 'text-foreground'
                  )}
                >
                  {step.title}
                </p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>

        <Link
          href={ROUTES.setup}
          className="mt-4 inline-flex min-h-touch items-center text-sm font-medium text-brand-700 underline"
        >
          See every step and finish setting up
        </Link>
      </CardContent>
    </Card>
  );
}
