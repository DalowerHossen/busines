import { forwardRef, type HTMLAttributes, type LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Label } from './label';

export const Field = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('space-y-2', className)} {...props} />
  )
);
Field.displayName = 'Field';

export interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  readonly required?: boolean;
}

export const FieldLabel = forwardRef<HTMLLabelElement, FieldLabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <Label ref={ref} required={required} className={cn('mb-0', className)} {...props}>
      {children}
    </Label>
  )
);
FieldLabel.displayName = 'FieldLabel';

export const FieldDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-xs leading-5 text-muted-foreground', className)} {...props} />
));
FieldDescription.displayName = 'FieldDescription';

export const FieldError = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      role="alert"
      className={cn('text-xs font-medium text-destructive', className)}
      {...props}
    />
  )
);
FieldError.displayName = 'FieldError';
