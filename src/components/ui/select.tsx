import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly error?: string;
  readonly isInvalid?: boolean;
  readonly options?: readonly SelectOption[];
  readonly placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      error,
      isInvalid,
      id,
      children,
      options,
      placeholder,
      'aria-describedby': describedBy,
      ...props
    },
    ref
  ) => {
    const invalid = Boolean(error || isInvalid);
    const errorId = error && id ? `${id}-error` : undefined;
    const ariaDescribedBy = [describedBy, errorId].filter(Boolean).join(' ') || undefined;
    return (
      <>
        <select
          ref={ref}
          id={id}
          className={cn(
            'h-11 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-[border-color,box-shadow] duration-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70',
            invalid && 'border-destructive focus:border-destructive focus:ring-destructive/20',
            className
          )}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={ariaDescribedBy}
          {...props}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          {children}
        </select>
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
Select.displayName = 'Select';
