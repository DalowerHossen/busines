import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly error?: string;
  readonly isInvalid?: boolean;
  readonly startAdornment?: ReactNode;
  readonly endAdornment?: ReactNode;
  readonly label?: ReactNode;
  readonly description?: ReactNode;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      error,
      isInvalid,
      startAdornment,
      endAdornment,
      label,
      description,
      id,
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
        {label ? (
          <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
            {label}
          </label>
        ) : null}
        {description ? <p className="mb-1.5 text-xs text-muted-foreground">{description}</p> : null}
        <span className="relative block">
          {startAdornment ? (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
              {startAdornment}
            </span>
          ) : null}
          <input
            ref={ref}
            id={id}
            className={cn(
              'flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-[border-color,box-shadow] duration-fast placeholder:text-muted-foreground/70 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70',
              startAdornment && 'pl-10',
              endAdornment && 'pr-10',
              invalid && 'border-destructive focus:border-destructive focus:ring-destructive/20',
              className
            )}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={ariaDescribedBy}
            {...props}
          />
          {endAdornment ? (
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
              {endAdornment}
            </span>
          ) : null}
        </span>
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
Input.displayName = 'Input';
