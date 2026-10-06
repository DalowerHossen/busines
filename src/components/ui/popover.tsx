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

interface PopoverContextValue {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly contentId: string;
}
const PopoverContext = createContext<PopoverContextValue | null>(null);
function usePopover(): PopoverContextValue {
  const context = useContext(PopoverContext);
  if (!context) throw new Error('Popover components must be used inside Popover.');
  return context;
}

export function Popover({
  children,
  defaultOpen = false,
}: {
  readonly children: ReactNode;
  readonly defaultOpen?: boolean;
}): ReactNode {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  return (
    <PopoverContext.Provider value={{ open, setOpen, contentId }}>
      {children}
    </PopoverContext.Provider>
  );
}

export const PopoverTrigger = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, type = 'button', ...props }, ref) => {
  const context = usePopover();
  return (
    <button
      ref={ref}
      type={type}
      aria-expanded={context.open}
      aria-controls={context.open ? context.contentId : undefined}
      className={className}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) context.setOpen(!context.open);
      }}
      {...props}
    />
  );
});
PopoverTrigger.displayName = 'PopoverTrigger';

export interface PopoverContentProps extends HTMLAttributes<HTMLDivElement> {
  readonly align?: 'start' | 'end';
}

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, align = 'start', children, ...props }, ref) => {
    const context = usePopover();
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
      const closeOnEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') context.setOpen(false);
      };
      document.addEventListener('mousedown', closeOnOutsideClick);
      document.addEventListener('keydown', closeOnEscape);
      return () => {
        document.removeEventListener('mousedown', closeOnOutsideClick);
        document.removeEventListener('keydown', closeOnEscape);
      };
    }, [context]);
    if (!context.open) return null;
    return (
      <div
        ref={setRefs}
        id={context.contentId}
        role="dialog"
        className={cn(
          'absolute z-dropdown mt-2 min-w-64 animate-fade-in rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg outline-none',
          align === 'end' ? 'right-0' : 'left-0',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
PopoverContent.displayName = 'PopoverContent';

export const PopoverClose = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, type = 'button', ...props }, ref) => {
    const context = usePopover();
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'text-sm font-semibold text-muted-foreground hover:text-foreground',
          className
        )}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) context.setOpen(false);
        }}
        {...props}
      />
    );
  }
);
PopoverClose.displayName = 'PopoverClose';
