import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const alertVariants = cva('relative flex gap-3 rounded-xl border p-4 text-sm', {
  variants: {
    variant: {
      info: 'border-info/25 bg-info-subtle text-info-foreground',
      neutral: 'border-border bg-surface-muted text-foreground',
      success: 'border-success/25 bg-success-subtle text-success-foreground',
      warning: 'border-warning/30 bg-warning-subtle text-warning-foreground',
      danger: 'border-destructive/25 bg-destructive-subtle text-destructive-foreground',
    },
  },
  defaultVariants: { variant: 'info' },
});

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  readonly icon?: ReactNode;
  readonly tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  readonly title?: string;
  readonly action?: ReactNode;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, tone, icon, title, action, children, ...props }, ref) => {
    const resolvedVariant = variant ?? (tone === 'neutral' ? 'neutral' : tone);
    return (
      <div
        ref={ref}
        role="status"
        className={cn(alertVariants({ variant: resolvedVariant, className }))}
        {...props}
      >
        {icon ? (
          <span className="mt-0.5 shrink-0" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div className={title ? 'mt-1' : undefined}>{children}</div> : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    );
  }
);
Alert.displayName = 'Alert';

export const AlertTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('font-semibold', className)} {...props} />
  )
);
AlertTitle.displayName = 'AlertTitle';

export const AlertDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('mt-1 leading-6 opacity-90', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';

export { alertVariants };
