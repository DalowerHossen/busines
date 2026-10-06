'use client';

import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { IconButton } from './button';

interface DialogContextValue {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly titleId: string;
  readonly descriptionId: string;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) throw new Error('Dialog components must be used inside Dialog.');
  return context;
}

export function Dialog({
  open = false,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly children: ReactNode;
}): ReactNode {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = onOpenChange !== undefined || open !== false;
  const resolvedOpen = isControlled ? open : uncontrolledOpen;
  const id = useId();
  const change = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  return (
    <DialogContext.Provider
      value={{
        open: resolvedOpen,
        onOpenChange: change,
        titleId: `${id}-title`,
        descriptionId: `${id}-description`,
      }}
    >
      {children}
    </DialogContext.Provider>
  );
}

export const DialogTrigger = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, type = 'button', ...props }, ref) => {
    const context = useDialogContext();
    return (
      <button
        ref={ref}
        type={type}
        className={className}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) context.onOpenChange(true);
        }}
        {...props}
      />
    );
  }
);
DialogTrigger.displayName = 'DialogTrigger';

export interface DialogContentProps extends HTMLAttributes<HTMLElement> {
  readonly closeLabel?: string;
  readonly showClose?: boolean;
}

export const DialogContent = forwardRef<HTMLElement, DialogContentProps>(
  ({ className, children, closeLabel = 'Close dialog', showClose = true, ...props }, ref) => {
    const context = useDialogContext();
    const { open, onOpenChange } = context;
    const contentRef = useRef<HTMLElement | null>(null);
    const restoreFocusRef = useRef<HTMLElement | null>(null);
    const setRefs = useCallback(
      (node: HTMLElement | null) => {
        contentRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );

    useEffect(() => {
      if (!open) return undefined;
      restoreFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onOpenChange(false);
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      const animationFrame = window.requestAnimationFrame(() => {
        const firstFocusable = contentRef.current?.querySelector<HTMLElement>(
          '[data-dialog-autofocus], button, input, textarea, select, [href], [tabindex]:not([tabindex="-1"])'
        );
        (firstFocusable ?? contentRef.current)?.focus();
      });
      return () => {
        window.cancelAnimationFrame(animationFrame);
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = previousOverflow;
        restoreFocusRef.current?.focus();
      };
    }, [open, onOpenChange]);

    if (!context.open || typeof document === 'undefined') return null;
    return createPortal(
      <div
        className="fixed inset-0 z-modal flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) context.onOpenChange(false);
        }}
      >
        <section
          ref={setRefs}
          role="dialog"
          aria-modal="true"
          aria-labelledby={context.titleId}
          aria-describedby={context.descriptionId}
          tabIndex={-1}
          className={cn(
            'relative max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg outline-none',
            className
          )}
          {...props}
        >
          {showClose ? (
            <IconButton
              label={closeLabel}
              variant="quiet"
              className="absolute right-3 top-3"
              onClick={() => context.onOpenChange(false)}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          ) : null}
          {children}
        </section>
      </div>,
      document.body
    );
  }
);
DialogContent.displayName = 'DialogContent';

export const DialogTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    const context = useDialogContext();
    return (
      <h2
        ref={ref}
        id={context.titleId}
        className={cn('font-heading text-xl font-semibold tracking-tight', className)}
        {...props}
      />
    );
  }
);
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const context = useDialogContext();
  return (
    <p
      ref={ref}
      id={context.descriptionId}
      className={cn('mt-1.5 text-sm leading-6 text-muted-foreground', className)}
      {...props}
    />
  );
});
DialogDescription.displayName = 'DialogDescription';

export const DialogClose = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, type = 'button', ...props }, ref) => {
    const context = useDialogContext();
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline',
          className
        )}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) context.onOpenChange(false);
        }}
        {...props}
      />
    );
  }
);
DialogClose.displayName = 'DialogClose';

export const Sheet = Dialog;
export const SheetTrigger = DialogTrigger;
export const SheetTitle = DialogTitle;
export const SheetDescription = DialogDescription;
export const SheetClose = DialogClose;

export interface SheetContentProps extends DialogContentProps {
  readonly side?: 'left' | 'right' | 'top' | 'bottom';
}

export const SheetContent = forwardRef<HTMLElement, SheetContentProps>(
  ({ className, side = 'right', ...props }, ref) => (
    <DialogContent
      ref={ref}
      className={cn(
        'fixed inset-auto flex max-h-none rounded-none p-6',
        side === 'right' && 'inset-y-0 right-0 h-full max-w-md rounded-l-xl border-y-0 border-r-0',
        side === 'left' && 'inset-y-0 left-0 h-full max-w-md rounded-r-xl border-y-0 border-l-0',
        side === 'top' && 'inset-x-0 top-0 max-w-none rounded-b-xl border-x-0 border-t-0',
        side === 'bottom' && 'inset-x-0 bottom-0 max-w-none rounded-t-xl border-x-0 border-b-0',
        className
      )}
      {...props}
    />
  )
);
SheetContent.displayName = 'SheetContent';
