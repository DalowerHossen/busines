import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, id, 'aria-describedby': describedBy, ...props }, ref) => {
    const errorId = error && id ? `${id}-error` : undefined;
    const ariaDescribedBy = [describedBy, errorId].filter(Boolean).join(' ') || undefined;
    return (
      <>
        <textarea
          ref={ref}
          id={id}
          className={cn(
            'flex min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground shadow-xs outline-none transition-[border-color,box-shadow] duration-fast placeholder:text-muted-foreground/70 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70',
            error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
            className
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={ariaDescribedBy}
          {...props}
        />
        {error && id ? (
          <span
            id={errorId}
            role="alert"
            className="mt-1.5 block text-xs font-medium text-destructive"
          >
            {error}
          </span>
        ) : null}
      </>
    );
  }
);

Textarea.displayName = 'Textarea';
