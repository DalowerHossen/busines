import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label?: ReactNode;
  readonly description?: ReactNode;
}
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, type = 'checkbox', label, description, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        type={type}
        className={cn(
          'h-4 w-4 shrink-0 rounded border-input text-primary accent-[hsl(var(--primary))] shadow-xs transition focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    );
    if (!label && !description) return input;
    return (
      <label className="flex items-start gap-3">
        {input}
        <span>
          {label ? <span className="block text-sm font-medium">{label}</span> : null}
          {description ? (
            <span className="block text-xs text-muted-foreground">{description}</span>
          ) : null}
        </span>
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';
