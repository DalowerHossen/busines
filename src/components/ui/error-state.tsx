// src/components/ui/error-state.tsx
// What a page or a panel shows when loading failed. It says what went wrong
// in plain words and offers a way to try again.

'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  /** Short heading. */
  title?: string;
  /** The message to show, already safe for a user to read. */
  message: string;
  /** Called when the retry button is pressed. */
  onRetry?: () => void;
  /** Reference a person can quote to support. */
  reference?: string | null;
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Renders a failure state with a retry action.
 *
 * @param props Heading, message and retry handler.
 * @returns The rendered error state.
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  reference,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive-subtle px-6 py-12 text-center',
        className
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle aria-hidden="true" className="h-6 w-6" />
      </span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="max-w-prose text-sm text-muted-foreground">{message}</p>
      {reference ? <p className="text-xs text-muted-foreground">Reference: {reference}</p> : null}
      {onRetry ? (
        <Button
          variant="outline"
          onClick={onRetry}
          leadingIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}
