// src/hooks/use-focus-trap.ts
// Keeps keyboard focus inside a dialog while it is open, and gives focus back
// to whatever opened it afterwards.

'use client';

import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Traps focus inside an element while it is active.
 *
 * @param ref Element to trap focus inside.
 * @param isActive True while the dialog is open.
 * @param onEscape Called when the escape key is pressed.
 * @returns Nothing.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement>,
  isActive: boolean,
  onEscape?: () => void
): void {
  useEffect(() => {
    if (!isActive) {
      return;
    }

    const container = ref.current;
    const previouslyFocused = document.activeElement;

    if (container) {
      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusable[0] ?? container).focus();
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape' && onEscape) {
        event.stopPropagation();
        onEscape();
        return;
      }

      if (event.key !== 'Tab' || !container) {
        return;
      }

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);

      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [ref, isActive, onEscape]);
}
