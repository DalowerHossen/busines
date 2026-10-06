import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  readonly value?: number;
  readonly max?: number;
  readonly label?: string;
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, label, ...props }, ref) => {
    const safeMax = max > 0 ? max : 100;
    const percentage = Math.min(100, Math.max(0, (value / safeMax) * 100));
    return (
      <div ref={ref} className={cn('space-y-2', className)} {...props}>
        {label ? (
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{label}</span>
            <span>{Math.round(percentage)}%</span>
          </div>
        ) : null}
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={safeMax}
          aria-valuenow={value}
          aria-label={label}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-slow ease-standard"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);
Progress.displayName = 'Progress';
