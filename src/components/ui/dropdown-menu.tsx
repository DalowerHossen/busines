'use client';

import {
  forwardRef,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  createContext,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

interface DropdownContextValue {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly menuId: string;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);
function useDropdown(): DropdownContextValue {
  const context = useContext(DropdownContext);
  if (!context) throw new Error('Dropdown menu components must be used inside DropdownMenu.');
  return context;
}

export function DropdownMenu({
  children,
  defaultOpen = false,
}: {
  readonly children: ReactNode;
  readonly defaultOpen?: boolean;
}): ReactNode {
  const [open, setOpen] = useState(defaultOpen);
  const menuId = useId();
  return (
    <DropdownContext.Provider value={{ open, setOpen, menuId }}>
      {children}
    </DropdownContext.Provider>
  );
}

export const DropdownMenuTrigger = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, type = 'button', ...props }, ref) => {
  const context = useDropdown();
  return (
    <button
      ref={ref}
      type={type}
      aria-haspopup="menu"
      aria-expanded={context.open}
      aria-controls={context.open ? context.menuId : undefined}
      className={className}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) context.setOpen(!context.open);
      }}
      {...props}
    />
  );
});
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

export interface DropdownMenuContentProps extends HTMLAttributes<HTMLDivElement> {
  readonly align?: 'start' | 'end';
}

export const DropdownMenuContent = forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, align = 'end', children, onKeyDown, ...props }, ref) => {
    const context = useDropdown();
    const localRef = useRef<HTMLDivElement | null>(null);
    const setRefs = (node: HTMLDivElement | null) => {
      localRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };
    useEffect(() => {
      if (!context.open) return undefined;
      const closeOnOutsideClick = (event: MouseEvent) => {
        if (localRef.current && !localRef.current.parentElement?.contains(event.target as Node))
          context.setOpen(false);
      };
      document.addEventListener('mousedown', closeOnOutsideClick);
      const firstItem = localRef.current?.querySelector<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"])'
      );
      firstItem?.focus();
      return () => document.removeEventListener('mousedown', closeOnOutsideClick);
    }, [context]);
    if (!context.open) return null;
    return (
      <div
        ref={setRefs}
        id={context.menuId}
        role="menu"
        tabIndex={-1}
        className={cn(
          'absolute right-0 z-dropdown mt-2 min-w-48 origin-top-right animate-fade-in rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none',
          align === 'start' && 'left-0 right-auto origin-top-left',
          className
        )}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          const items = Array.from(
            localRef.current?.querySelectorAll<HTMLElement>(
              '[role="menuitem"]:not([aria-disabled="true"])'
            ) ?? []
          );
          const currentIndex = items.indexOf(document.activeElement as HTMLElement);
          if (event.key === 'Escape') {
            event.preventDefault();
            context.setOpen(false);
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            items[(currentIndex + direction + items.length) % items.length]?.focus();
          }
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

export interface DropdownMenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly inset?: boolean;
}

export const DropdownMenuItem = forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  ({ className, inset, onClick, disabled, type = 'button', ...props }, ref) => {
    const context = useDropdown();
    return (
      <button
        ref={ref}
        type={type}
        role="menuitem"
        aria-disabled={disabled || undefined}
        disabled={disabled}
        className={cn(
          'flex min-h-10 w-full items-center rounded-md px-3 text-left text-sm outline-none transition-colors duration-fast hover:bg-surface-muted focus:bg-surface-muted disabled:pointer-events-none disabled:opacity-50',
          inset && 'pl-9',
          className
        )}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented && !disabled) context.setOpen(false);
        }}
        {...props}
      />
    );
  }
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuCheckboxItem = forwardRef<
  HTMLButtonElement,
  DropdownMenuItemProps & {
    readonly checked?: boolean;
    readonly onCheckedChange?: (checked: boolean) => void;
  }
>(
  (
    { checked = false, onCheckedChange, children, onClick, className, disabled, inset, ...props },
    ref
  ) => {
    const context = useDropdown();
    return (
      <button
        ref={ref}
        type="button"
        role="menuitemcheckbox"
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        className={cn(
          'flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm outline-none transition-colors duration-fast hover:bg-surface-muted focus:bg-surface-muted disabled:pointer-events-none disabled:opacity-50',
          inset && 'pl-9',
          className
        )}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented && !disabled) onCheckedChange?.(!checked);
          if (!disabled) context.setOpen(false);
        }}
        {...props}
      >
        <span
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded border text-[10px]',
            checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
          )}
          aria-hidden="true"
        >
          {checked ? '✓' : null}
        </span>
        {children}
      </button>
    );
  }
);
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

export const DropdownMenuLabel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground',
        className
      )}
      {...props}
    />
  )
);
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

export const DropdownMenuSeparator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} role="separator" className={cn('my-1.5 h-px bg-border', className)} {...props} />
  )
);
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';
