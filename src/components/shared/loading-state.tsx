import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface LoadingStateProps {
  readonly label?: string;
  readonly className?: string;
  readonly compact?: boolean;
}

export function LoadingState({
  label = 'Loading',
  className,
  compact = false,
}: LoadingStateProps): ReactNode {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center text-muted-foreground',
        compact ? 'gap-2 py-6 text-sm' : 'min-h-48 flex-col gap-3 py-12 text-sm',
        className
      )}
    >
      <LoaderCircle className="h-5 w-5 animate-spin text-brand-600" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
