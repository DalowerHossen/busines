// src/components/ui/select.tsx
// A native select, styled to match the rest of the fields. Native is the
// right choice here: it works on every phone and with every screen reader.

import { ChevronDown } from 'lucide-react';
import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';
import type { SelectOption } from '@/types/common';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Options to offer. */
  options: readonly SelectOption[];
  /** Entry shown when nothing has been chosen yet. */
  placeholder?: string;
  /** True when the field failed validation. */
  isInvalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, options, placeholder, isInvalid = false, ...props },
  ref
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={isInvalid || undefined}
        className={cn(
          'h-11 min-h-touch w-full appearance-none rounded-md border bg-surface pl-3 pr-10 text-sm text-foreground transition-colors duration-fast',
          'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70',
          isInvalid ? 'border-destructive' : 'border-input',
          className
        )}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
});
