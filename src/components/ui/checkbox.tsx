import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'checkbox', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-4 w-4 shrink-0 rounded border-input text-primary accent-[hsl(var(--primary))] shadow-xs transition focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Checkbox.displayName = 'Checkbox';
