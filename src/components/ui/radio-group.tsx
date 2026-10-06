'use client';

import {
  createContext,
  forwardRef,
  useContext,
  useState,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

interface RadioContextValue {
  readonly value: string | undefined;
  readonly setValue: (value: string) => void;
  readonly name: string;
}
const RadioContext = createContext<RadioContextValue | null>(null);
function useRadio(): RadioContextValue {
  const context = useContext(RadioContext);
  if (!context) throw new Error('Radio group items must be used inside RadioGroup.');
  return context;
}

export function RadioGroup({
  defaultValue,
  value,
  name = 'radio-group',
  onValueChange,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLFieldSetElement> & {
  readonly defaultValue?: string;
  readonly value?: string;
  readonly name?: string;
  readonly onValueChange?: (value: string) => void;
  readonly children: ReactNode;
}): ReactNode {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const controlled = value !== undefined;
  const resolvedValue = controlled ? value : internalValue;
  const setValue = (next: string) => {
    if (!controlled) setInternalValue(next);
    onValueChange?.(next);
  };
  return (
    <RadioContext.Provider value={{ value: resolvedValue, setValue, name }}>
      <fieldset className={cn('space-y-3', className)} {...props}>
        {children}
      </fieldset>
    </RadioContext.Provider>
  );
}

export interface RadioGroupItemProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name' | 'value'> {
  readonly value: string;
}
export const RadioGroupItem = forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, id, ...props }, ref) => {
    const context = useRadio();
    const checked = context.value === value;
    return (
      <input
        ref={ref}
        id={id}
        type="radio"
        name={context.name}
        value={value}
        checked={checked}
        onChange={() => context.setValue(value)}
        className={cn(
          'h-4 w-4 border-input text-primary accent-[hsl(var(--primary))] focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);
RadioGroupItem.displayName = 'RadioGroupItem';
