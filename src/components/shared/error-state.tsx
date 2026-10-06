import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface ErrorStateProps {
  readonly title?: string;
  readonly description?: string;
  readonly retryLabel?: string;
  readonly onRetry?: () => void;
  readonly className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this content. Try again or contact support if the problem continues.',
  retryLabel = 'Try again',
  onRetry,
  className,
}: ErrorStateProps): ReactNode {
  return (
    <div
      role="alert"
      className={cn(
        'flex min-h-56 flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive-subtle/40 px-6 py-10 text-center',
        className
      )}
    >
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="font-heading text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-5"
          onClick={onRetry}
          leftIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
        >
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
