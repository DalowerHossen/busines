// src/components/ui/input.tsx
// A single line field. It is tall enough to tap, marks itself as invalid for
// assistive technology and can carry a prefix such as a currency symbol.

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  /** True when the field failed validation. */
  isInvalid?: boolean;
  /** Short text or icon shown inside the field, before the value. */
  prefix?: ReactNode;
  /** Short text or icon shown inside the field, after the value. */
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, isInvalid = false, prefix, suffix, disabled, ...props },
  ref
) {
  const field = (
    <input
      ref={ref}
      disabled={disabled}
      aria-invalid={isInvalid || undefined}
      className={cn(
        'h-11 min-h-touch w-full rounded-md border bg-surface px-3 text-sm text-foreground transition-colors duration-fast',
        'placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70',
        isInvalid ? 'border-destructive' : 'border-input',
        prefix ? 'rounded-l-none border-l-0' : '',
        suffix ? 'rounded-r-none border-r-0' : '',
        className
      )}
      {...props}
    />
  );

  if (!prefix && !suffix) {
    return field;
  }

  return (
    <div
      className={cn(
        'flex w-full items-stretch rounded-md border',
        isInvalid ? 'border-destructive' : 'border-input'
      )}
    >
      {prefix ? (
        <span className="flex items-center rounded-l-md bg-surface-muted px-3 text-sm text-muted-foreground">
          {prefix}
        </span>
      ) : null}
      {field}
      {suffix ? (
        <span className="flex items-center rounded-r-md bg-surface-muted px-3 text-sm text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  );
});
