// src/components/ui/checkbox.tsx
// A checkbox with its label, sized so the whole row is a comfortable tap
// target rather than just the box.

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Text shown beside the box. */
  label: ReactNode;
  /** Smaller explanatory text under the label. */
  description?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, description, id, disabled, ...props },
  ref
) {
  const describedBy = description && id ? `${id}-description` : undefined;

  return (
    <div className={cn('flex min-h-touch items-start gap-3 py-1', className)}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        disabled={disabled}
        aria-describedby={describedBy}
        className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border-input text-primary accent-primary disabled:cursor-not-allowed"
        {...props}
      />
      <span className="flex flex-col">
        <label
          htmlFor={id}
          className={cn(
            'cursor-pointer text-sm font-medium text-foreground',
            disabled ? 'cursor-not-allowed opacity-70' : ''
          )}
        >
          {label}
        </label>
        {description ? (
          <span id={describedBy} className="text-sm text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  );
});
