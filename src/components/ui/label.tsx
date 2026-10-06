// src/components/ui/label.tsx
// The label above every field. A required field says so in words as well as
// with the asterisk, so a screen reader announces it.

import { forwardRef, type LabelHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Marks the field as required. */
  isRequired?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, isRequired = false, children, ...props },
  ref
) {
  return (
    <label
      ref={ref}
      className={cn('block text-sm font-medium leading-6 text-foreground', className)}
      {...props}
    >
      {children}
      {isRequired ? (
        <>
          <span aria-hidden="true" className="ml-1 text-destructive">
            *
          </span>
          <span className="visually-hidden"> (required)</span>
        </>
      ) : null}
    </label>
  );
});
