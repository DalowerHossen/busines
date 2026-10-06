// src/components/ui/textarea.tsx
// A multi line field, used for notes, terms and message bodies.

import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** True when the field failed validation. */
  isInvalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, isInvalid = false, rows = 4, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={isInvalid || undefined}
      className={cn(
        'w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground transition-colors duration-fast',
        'placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70',
        isInvalid ? 'border-destructive' : 'border-input',
        className
      )}
      {...props}
    />
  );
});
