// src/components/ui/toaster.tsx
// Short confirmations and failures, shown above everything else. One helper
// is used everywhere so the wording and the timing stay consistent.

'use client';

import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';

/**
 * Renders the region that holds every toast.
 *
 * @returns The rendered toaster.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      richColors
      duration={5000}
      toastOptions={{
        classNames: {
          toast: 'rounded-md border border-border bg-surface text-foreground shadow-md',
          description: 'text-muted-foreground',
        },
      }}
    />
  );
}

export const notify = {
  /**
   * Confirms that something worked.
   *
   * @param message Short sentence describing what happened.
   * @param description Extra detail shown underneath.
   * @returns Nothing.
   */
  success(message: string, description?: string): void {
    sonnerToast.success(message, description ? { description } : undefined);
  },

  /**
   * Reports that something failed.
   *
   * @param message Short sentence describing the failure.
   * @param description Extra detail shown underneath.
   * @returns Nothing.
   */
  error(message: string, description?: string): void {
    sonnerToast.error(message, description ? { description } : undefined);
  },

  /**
   * Draws attention to something that needs a decision.
   *
   * @param message Short sentence.
   * @param description Extra detail shown underneath.
   * @returns Nothing.
   */
  warning(message: string, description?: string): void {
    sonnerToast.warning(message, description ? { description } : undefined);
  },

  /**
   * States a neutral fact, such as a background job having started.
   *
   * @param message Short sentence.
   * @param description Extra detail shown underneath.
   * @returns Nothing.
   */
  info(message: string, description?: string): void {
    sonnerToast.info(message, description ? { description } : undefined);
  },
};
