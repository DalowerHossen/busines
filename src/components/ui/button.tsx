import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-touch items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold tracking-[-0.01em] transition-[background-color,border-color,box-shadow,color,transform] duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'shadow-brand/15 hover:shadow-brand/20 bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:shadow-md',
        secondary:
          'border border-border bg-surface text-foreground shadow-xs hover:border-brand-300 hover:bg-surface-raised',
        quiet: 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
        ghost: 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
        outline:
          'border border-brand-200 bg-transparent text-brand-700 hover:border-brand-400 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-300 dark:hover:bg-brand-950',
        danger: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        success: 'bg-success text-success-foreground shadow-sm hover:bg-success/90',
        link: 'min-h-0 rounded-sm p-0 text-brand-700 underline-offset-4 hover:text-brand-800 hover:underline dark:text-brand-300',
      },
      size: {
        sm: 'h-9 px-3 text-xs',
        md: 'h-11 px-4',
        lg: 'h-12 px-5 text-base',
        icon: 'h-11 w-11 shrink-0 p-0',
      },
      fullWidth: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', fullWidth: false },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  readonly loading?: boolean;
  readonly isLoading?: boolean;
  readonly loadingLabel?: string;
  readonly leftIcon?: ReactNode;
  readonly rightIcon?: ReactNode;
  readonly leadingIcon?: ReactNode;
  readonly trailingIcon?: ReactNode;
  readonly fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      loading = false,
      isLoading = false,
      loadingLabel = 'Loading',
      leftIcon,
      rightIcon,
      leadingIcon,
      trailingIcon,
      children,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const busy = loading || isLoading;
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        {...props}
      >
        {busy ? (
          <>
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
            />
            <span>{loadingLabel}</span>
          </>
        ) : (
          <>
            {leftIcon ?? leadingIcon}
            {children}
            {rightIcon ?? trailingIcon}
          </>
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';

export function IconButton({
  label,
  className,
  children,
  ...props
}: Omit<ButtonProps, 'size' | 'children' | 'aria-label'> & {
  readonly label: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <Button {...props} size="icon" className={className} aria-label={label}>
      {children}
    </Button>
  );
}

export { buttonVariants };
