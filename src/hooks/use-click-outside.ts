// src/hooks/use-click-outside.ts
// Closes a panel when the pointer goes down anywhere else on the page.

'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Calls a handler when a pointer press lands outside an element.
 *
 * @param ref Element that should stay open.
 * @param handler Called when the press was outside.
 * @param isEnabled False to stop listening, for example while closed.
 * @returns Nothing.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement>,
  handler: () => void,
  isEnabled = true
): void {
  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    function onPointerDown(event: MouseEvent | TouchEvent): void {
      const element = ref.current;

      if (!element || !(event.target instanceof Node)) {
        return;
      }

      if (!element.contains(event.target)) {
        handler();
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [ref, handler, isEnabled]);
}
