'use client';

import { ChevronDown } from 'lucide-react';
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

interface AccordionContextValue {
  readonly values: readonly string[];
  readonly toggle: (value: string) => void;
  readonly type: 'single' | 'multiple';
}
const AccordionContext = createContext<AccordionContextValue | null>(null);
interface AccordionItemContextValue {
  readonly value: string;
  readonly contentId: string;
  readonly triggerId: string;
}
const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);
function useAccordion(): AccordionContextValue {
  const context = useContext(AccordionContext);
  if (!context) throw new Error('Accordion components must be used inside Accordion.');
  return context;
}
function useAccordionItem(): AccordionItemContextValue {
  const context = useContext(AccordionItemContext);
  if (!context) throw new Error('Accordion content must be used inside AccordionItem.');
  return context;
}

export function Accordion({
  type = 'single',
  defaultValue = [],
  children,
}: {
  readonly type?: 'single' | 'multiple';
  readonly defaultValue?: string | readonly string[];
  readonly children: ReactNode;
}): ReactNode {
  const initial = Array.isArray(defaultValue) ? defaultValue : [defaultValue];
  const [values, setValues] = useState<readonly string[]>(initial);
  const toggle = (value: string) =>
    setValues((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : type === 'single'
          ? [value]
          : [...current, value]
    );
  return (
    <AccordionContext.Provider value={{ values, toggle, type }}>
      {children}
    </AccordionContext.Provider>
  );
}

export const AccordionItem = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { readonly value: string }
>(({ className, value, ...props }, ref) => {
  const id = useId();
  return (
    <AccordionItemContext.Provider
      value={{ value, contentId: `${id}-content`, triggerId: `${id}-trigger` }}
    >
      <div ref={ref} className={cn('border-b border-border', className)} {...props} />
    </AccordionItemContext.Provider>
  );
});
AccordionItem.displayName = 'AccordionItem';

export const AccordionTrigger = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, onClick, type = 'button', ...props }, ref) => {
  const accordion = useAccordion();
  const item = useAccordionItem();
  const open = accordion.values.includes(item.value);
  return (
    <button
      ref={ref}
      type={type}
      id={item.triggerId}
      aria-controls={item.contentId}
      aria-expanded={open}
      className={cn(
        'flex min-h-14 w-full items-center justify-between py-4 text-left text-sm font-semibold text-foreground transition-colors duration-fast hover:text-brand-700',
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) accordion.toggle(item.value);
      }}
      {...props}
    >
      {children}
      <ChevronDown
        className={cn(
          'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-fast',
          open && 'rotate-180'
        )}
        aria-hidden="true"
      />
    </button>
  );
});
AccordionTrigger.displayName = 'AccordionTrigger';

export const AccordionContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const accordion = useAccordion();
    const item = useAccordionItem();
    const open = accordion.values.includes(item.value);
    return (
      <div
        ref={ref}
        id={item.contentId}
        role="region"
        aria-labelledby={item.triggerId}
        hidden={!open}
        className={cn('pb-4 text-sm leading-6 text-muted-foreground', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
AccordionContent.displayName = 'AccordionContent';
