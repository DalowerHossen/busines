// src/components/ui/switch.tsx
// An on and off control for settings that take effect immediately.

'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'type'> {
  /** Current state. */
  checked: boolean;
  /** Called with the new state when the control is pressed. */
  onCheckedChange: (checked: boolean) => void;
  /** Accessible name, required when no visible label is attached. */
  label: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { className, checked, onCheckedChange, label, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        onCheckedChange(!checked);
      }}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-fast',
        'disabled:cursor-not-allowed disabled:opacity-60',
        checked ? 'bg-primary' : 'bg-muted',
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-fast',
          checked ? 'translate-x-5' : 'translate-x-1'
        )}
      />
    </button>
  );
});
