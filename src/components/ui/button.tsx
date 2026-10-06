// src/components/ui/button.tsx
// The button every action in the product uses. It is at least forty four
// pixels tall so it can be tapped, shows a spinner while it is working and
// never loses its accessible name while it does.

import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-fast ease-standard disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-muted',
        outline: 'border border-input bg-surface text-foreground hover:bg-surface-muted',
        ghost: 'text-foreground hover:bg-surface-muted',
        destructive: 'bg-destructive text-destructive-foreground shadow-xs hover:opacity-90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 min-h-0 px-3 text-sm',
        md: 'h-11 min-h-touch px-4',
        lg: 'h-12 min-h-touch px-6 text-base',
        icon: 'h-11 min-h-touch w-11 min-w-touch p-0',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Shows a spinner and blocks further clicks. */
  isLoading?: boolean;
  /** Replaces the label while the button is working. */
  loadingLabel?: string;
  /** Icon shown before the label. */
  leadingIcon?: ReactNode;
  /** Icon shown after the label. */
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    fullWidth,
    isLoading = false,
    loadingLabel,
    leadingIcon,
    trailingIcon,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled === true || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : leadingIcon}
      <span>{isLoading && loadingLabel ? loadingLabel : children}</span>
      {!isLoading && trailingIcon}
    </button>
  );
});

export { buttonVariants };
