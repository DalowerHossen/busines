// src/components/ui/tabs.tsx
// Tabs that follow the keyboard pattern people expect: the arrow keys move
// between tabs and only the selected tab is in the tab order.

'use client';

import { useId, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface TabDefinition {
  /** Stable key, also used in the query string when tabs are linkable. */
  value: string;
  /** Text on the tab. */
  label: string;
  /** Small count shown after the label. */
  count?: number;
  /** Panel content. */
  content: ReactNode;
}

export interface TabsProps {
  /** Tabs to show. */
  tabs: readonly TabDefinition[];
  /** Key of the selected tab. */
  value: string;
  /** Called with the key of the tab that was chosen. */
  onValueChange: (value: string) => void;
  /** Accessible name for the tab strip. */
  label: string;
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Renders a tab strip and the panel of the selected tab.
 *
 * @param props Tabs, selection and change handler.
 * @returns The rendered tabs.
 */
export function Tabs({ tabs, value, onValueChange, label, className }: TabsProps) {
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeTab = tabs.find((tab) => tab.value === value) ?? tabs[0];

  /**
   * Moves the selection with the arrow keys.
   *
   * @param event Keyboard event from a tab.
   * @param index Position of the tab that has focus.
   * @returns Nothing.
   */
  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }

    event.preventDefault();

    const step = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + step + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];

    if (nextTab) {
      onValueChange(nextTab.value);
      tabRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((tab, index) => {
          const isSelected = activeTab?.value === tab.value;

          return (
            <button
              key={tab.value}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.value}`}
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel-${tab.value}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => {
                onValueChange(tab.value);
              }}
              onKeyDown={(event) => {
                onKeyDown(event, index);
              }}
              className={cn(
                'min-h-touch whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                isSelected
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              {typeof tab.count === 'number' ? (
                <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {activeTab ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${activeTab.value}`}
          aria-labelledby={`${baseId}-tab-${activeTab.value}`}
          tabIndex={0}
        >
          {activeTab.content}
        </div>
      ) : null}
    </div>
  );
}
