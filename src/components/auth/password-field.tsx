// src/components/auth/password-field.tsx
// A password box that can be read back when somebody asks, and that says how
// strong the password is while it is being typed.

'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';

import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface PasswordFieldProps {
  /** Identifier of the control. */
  id: string;
  /** Name submitted with the form. */
  name: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Validation messages for this field. */
  errors?: readonly string[];
  /** Help text under the control. */
  hint?: string;
  /** True to show the strength meter. */
  showStrength?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  isRequired?: boolean;
}

interface Strength {
  score: number;
  label: string;
  barClassName: string;
}

/**
 * Scores a password on length and variety, for guidance rather than judgement.
 *
 * @param value Password being typed.
 * @returns A score out of four with a label.
 */
function scorePassword(value: string): Strength {
  let score = 0;

  if (value.length >= 12) {
    score += 1;
  }

  if (value.length >= 16) {
    score += 1;
  }

  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) {
    score += 1;
  }

  if (/[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value)) {
    score += 1;
  }

  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const colours = ['bg-destructive', 'bg-destructive', 'bg-warning', 'bg-brand-500', 'bg-success'];

  return {
    score,
    label: labels[score] ?? 'Weak',
    barClassName: colours[score] ?? 'bg-destructive',
  };
}

/**
 * Renders a password field with a reveal button and an optional meter.
 *
 * @param props Field state and behaviour.
 * @returns The rendered field.
 */
export function PasswordField({
  id,
  name,
  label,
  value,
  onValueChange,
  errors,
  hint,
  showStrength = false,
  disabled = false,
  autoComplete = 'current-password',
  isRequired = true,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const meterId = useId();
  const strength = scorePassword(value);

  return (
    <FormField id={id} label={label} hint={hint} errors={errors} isRequired={isRequired}>
      <div className="relative">
        <Input
          {...fieldAccessibilityProps(id, Boolean(hint), Boolean(errors && errors.length > 0))}
          name={name}
          type={isVisible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          disabled={disabled}
          className="pr-12"
          onChange={(event) => {
            onValueChange(event.target.value);
          }}
        />

        <button
          type="button"
          onClick={() => {
            setIsVisible((current) => !current);
          }}
          aria-pressed={isVisible}
          aria-label={isVisible ? 'Hide the password' : 'Show the password'}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {isVisible ? (
            <EyeOff aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Eye aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </div>

      {showStrength && value.length > 0 ? (
        <div className="space-y-1 pt-1">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="presentation"
            aria-hidden="true"
          >
            <div
              className={cn('duration-normal h-full transition-all', strength.barClassName)}
              style={{ width: `${Math.max(10, strength.score * 25)}%` }}
            />
          </div>
          <p id={meterId} aria-live="polite" className="text-xs text-muted-foreground">
            Password strength: {strength.label}
          </p>
        </div>
      ) : null}
    </FormField>
  );
}
