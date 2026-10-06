// src/components/ui/dropdown-menu.tsx
// The menu behind a row of actions. It opens on click, closes on escape or on
// a click outside, and the arrow keys walk through the items.

'use client';

import { type LucideIcon } from 'lucide-react';
import { useCallback, useRef, useState, type ReactNode } from 'react';

import { useClickOutside } from '@/hooks/use-click-outside';
import { cn } from '@/lib/utils';

export interface DropdownItem {
  /** Stable key for the item. */
  key: string;
  /** Text shown in the menu. */
  label: string;
  /** Icon shown before the text. */
  icon?: LucideIcon;
  /** Called when the item is chosen. */
  onSelect: () => void;
  /** Marks a destructive action, such as deleting. */
  isDestructive?: boolean;
  /** Greys the item out. */
  isDisabled?: boolean;
}

export interface DropdownMenuProps {
  /** The control that opens the menu. */
  trigger: ReactNode;
  /** Accessible name of the trigger. */
  triggerLabel: string;
  /** Items to offer. */
  items: readonly DropdownItem[];
  /** Which side of the trigger the panel appears on. */
  align?: 'start' | 'end';
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Renders a button that opens a list of actions.
 *
 * @param props Trigger, items and alignment.
 * @returns The rendered menu.
 */
export function DropdownMenu({
  trigger,
  triggerLabel,
  items,
  align = 'end',
  className,
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useClickOutside(containerRef, close, isOpen);

  /**
   * Moves focus between items with the arrow keys.
   *
   * @param event Keyboard event from an item.
   * @param index Position of the item that has focus.
   * @returns Nothing.
   */
  function onItemKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key === 'Escape') {
      close();
      return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }

    event.preventDefault();

    const step = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (index + step + items.length) % items.length;
    itemRefs.current[nextIndex]?.focus();
  }

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      <span
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={triggerLabel}
        onClick={() => {
          setIsOpen((open) => !open);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsOpen((open) => !open);
          }
        }}
        className="inline-flex"
      >
        {trigger}
      </span>

      {isOpen ? (
        <div
          role="menu"
          aria-label={triggerLabel}
          className={cn(
            'absolute z-dropdown mt-2 min-w-48 animate-fade-in overflow-hidden rounded-md border border-border bg-popover py-1 shadow-md',
            align === 'end' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item, index) => {
            const Icon = item.icon;

            return (
              <button
                key={item.key}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                role="menuitem"
                disabled={item.isDisabled}
                onKeyDown={(event) => {
                  onItemKeyDown(event, index);
                }}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
                className={cn(
                  'flex min-h-touch w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                  item.isDestructive
                    ? 'text-destructive hover:bg-destructive-subtle'
                    : 'text-popover-foreground hover:bg-surface-muted',
                  item.isDisabled ? 'cursor-not-allowed opacity-50' : ''
                )}
              >
                {Icon ? <Icon aria-hidden="true" className="h-4 w-4" /> : null}
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
