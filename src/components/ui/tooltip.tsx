'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

interface TooltipContextValue {
  readonly open: boolean;
}

const TooltipContext = createContext<TooltipContextValue | null>(null);

function useTooltip(): TooltipContextValue {
  const context = useContext(TooltipContext);
  if (!context) throw new Error('Tooltip components must be used inside Tooltip.');
  return context;
}

export function Tooltip({
  children,
  delay = 300,
}: {
  readonly children: ReactNode;
  readonly delay?: number;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const show = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  };

  return (
    <TooltipContext.Provider value={{ open }}>
      <span
        className="relative inline-flex"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
    </TooltipContext.Provider>
  );
}

export function TooltipTrigger({ children }: { readonly children: ReactNode }): ReactNode {
  return <span className="inline-flex">{children}</span>;
}

export function TooltipContent({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>): ReactNode {
  const context = useTooltip();
  if (!context.open) return null;
  return (
    <span
      role="tooltip"
      className={cn(
        'pointer-events-none absolute bottom-full left-1/2 z-tooltip mb-2 -translate-x-1/2 animate-fade-in whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white shadow-md dark:bg-white dark:text-slate-950',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
