// src/components/ui/modal.tsx
// A dialog that traps focus, closes on escape or on a click outside, and
// leaves the page behind it inert for assistive technology.

'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { cn } from '@/lib/utils';

const WIDTHS = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

export interface ModalProps {
  /** True while the dialog is shown. */
  isOpen: boolean;
  /** Called when the dialog asks to be closed. */
  onClose: () => void;
  /** Heading of the dialog. */
  title: string;
  /** Sentence under the heading. */
  description?: string;
  /** Body of the dialog. */
  children: ReactNode;
  /** Buttons shown at the bottom. */
  footer?: ReactNode;
  /** Width of the panel. */
  size?: keyof typeof WIDTHS;
  /** False to keep the dialog open when the backdrop is clicked. */
  closeOnBackdrop?: boolean;
}

/**
 * Renders a modal dialog in a portal at the end of the document.
 *
 * @param props Dialog state, content and actions.
 * @returns The rendered dialog, or null while it is closed.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useFocusTrap(panelRef, isOpen, onClose);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-modal flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        className="absolute inset-0 z-overlay cursor-default bg-foreground/40 backdrop-blur-sm"
        onClick={() => {
          if (closeOnBackdrop) {
            onClose();
          }
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-modal flex max-h-[92vh] w-full animate-slide-up flex-col rounded-t-xl bg-surface shadow-lg sm:rounded-xl',
          WIDTHS[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="space-y-1">
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close dialog"
            onClick={onClose}
            className="-mr-2 -mt-1"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="flex flex-col gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
