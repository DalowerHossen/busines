import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  readonly required?: boolean;
  readonly isRequired?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, isRequired, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('mb-2 block text-sm font-semibold text-foreground', className)}
      {...props}
    >
      {children}
      {required || isRequired ? (
        <span className="ml-1 text-destructive" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  )
);

Label.displayName = 'Label';
