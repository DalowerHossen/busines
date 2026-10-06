'use client';

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

interface TabsContextValue {
  readonly value: string;
  readonly setValue: (value: string) => void;
  readonly id: string;
}
const TabsContext = createContext<TabsContextValue | null>(null);
function useTabs(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tabs components must be used inside Tabs.');
  return context;
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
}: {
  readonly defaultValue: string;
  readonly value?: string;
  readonly onValueChange?: (value: string) => void;
  readonly children: ReactNode;
}): ReactNode {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const controlled = value !== undefined;
  const resolvedValue = controlled ? value : internalValue;
  const id = useId();
  const setValue = (nextValue: string) => {
    if (!controlled) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  };
  return (
    <TabsContext.Provider value={{ value: resolvedValue, setValue, id }}>
      {children}
    </TabsContext.Provider>
  );
}

export const TabsList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        'inline-flex min-h-11 items-center gap-1 rounded-lg bg-surface-muted p-1',
        className
      )}
      {...props}
    />
  )
);
TabsList.displayName = 'TabsList';

export interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly value: string;
}
export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onClick, onKeyDown, type = 'button', ...props }, ref) => {
    const context = useTabs();
    const active = context.value === value;
    const selectAdjacent = (direction: number) => {
      const tabs = Array.from(
        document.querySelectorAll<HTMLButtonElement>(`[role="tab"][data-tabs-id="${context.id}"]`)
      );
      const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
      tabs[(currentIndex + direction + tabs.length) % tabs.length]?.focus();
      tabs[(currentIndex + direction + tabs.length) % tabs.length]?.click();
    };
    return (
      <button
        ref={ref}
        type={type}
        id={`${context.id}-${value}`}
        role="tab"
        data-tabs-id={context.id}
        aria-controls={`${context.id}-${value}-panel`}
        aria-selected={active}
        tabIndex={active ? 0 : -1}
        className={cn(
          'min-h-9 rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active && 'bg-card text-foreground shadow-xs',
          className
        )}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) context.setValue(value);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            selectAdjacent(1);
          }
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            selectAdjacent(-1);
          }
        }}
        {...props}
      />
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  readonly value: string;
}
export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const context = useTabs();
    const active = context.value === value;
    return (
      <div
        ref={ref}
        id={`${context.id}-${value}-panel`}
        role="tabpanel"
        hidden={!active}
        tabIndex={0}
        aria-labelledby={`${context.id}-${value}`}
        className={cn('mt-4 outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
        {...props}
      />
    );
  }
);
TabsContent.displayName = 'TabsContent';
