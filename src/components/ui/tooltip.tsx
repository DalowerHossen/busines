// src/components/ui/tooltip.tsx
// A short hint shown on hover and on keyboard focus. The hint is always also
// available to a screen reader, never on hover alone.

'use client';

import { useId, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface TooltipProps {
  /** Text of the hint. */
  content: string;
  /** The element the hint describes. */
  children: ReactNode;
  /** Which side of the element the hint appears on. */
  side?: 'top' | 'bottom';
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Renders an element with a hint attached.
 *
 * @param props Hint text and the element it describes.
 * @returns The rendered element and its hint.
 */
export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => {
        setIsVisible(true);
      }}
      onMouseLeave={() => {
        setIsVisible(false);
      }}
      onFocus={() => {
        setIsVisible(true);
      }}
      onBlur={() => {
        setIsVisible(false);
      }}
    >
      <span aria-describedby={tooltipId} className="inline-flex">
        {children}
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-tooltip w-max max-w-xs -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background transition-opacity duration-fast',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          isVisible ? 'opacity-100' : 'opacity-0'
        )}
      >
        {content}
      </span>
    </span>
  );
}
