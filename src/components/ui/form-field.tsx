// src/components/ui/form-field.tsx
// Wraps one field with its label, hint and error message, and wires the
// accessibility attributes that connect them.

import { type ReactNode } from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface FormFieldProps {
  /** Identifier of the control this field describes. */
  id: string;
  /** Visible label text. */
  label: string;
  /** The control itself. */
  children: ReactNode;
  /** Short help text shown under the control. */
  hint?: string;
  /** Validation messages for this field. */
  errors?: readonly string[];
  /** Marks the field as required. */
  isRequired?: boolean;
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Lays out a labelled field with its hint and error message.
 *
 * @param props Field content and state.
 * @returns The rendered field.
 */
export function FormField({
  id,
  label,
  children,
  hint,
  errors,
  isRequired = false,
  className,
}: FormFieldProps) {
  const hasError = Boolean(errors && errors.length > 0);

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} isRequired={isRequired}>
        {label}
      </Label>
      {children}
      {hint && !hasError ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
          {errors?.join(' ')}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Builds the accessibility attributes a control needs to point at its hint
 * and its error message.
 *
 * @param id Identifier of the control.
 * @param hasHint True when a hint is shown.
 * @param hasError True when an error is shown.
 * @returns Attributes to spread onto the control.
 */
export function fieldAccessibilityProps(
  id: string,
  hasHint: boolean,
  hasError: boolean
): { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true } {
  const describedBy = [hasHint ? `${id}-hint` : null, hasError ? `${id}-error` : null]
    .filter((value): value is string => value !== null)
    .join(' ');

  return {
    id,
    ...(describedBy.length > 0 ? { 'aria-describedby': describedBy } : {}),
    ...(hasError ? { 'aria-invalid': true as const } : {}),
  };
}
