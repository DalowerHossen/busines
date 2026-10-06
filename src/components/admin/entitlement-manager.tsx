// src/components/admin/entitlement-manager.tsx
// The exceptions one tenant has to its plan: what was granted, why, and the
// form to grant or withdraw one.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { notify } from '@/components/ui/toaster';
import { grantEntitlement } from '@/features/admin/actions/grant-entitlement';
import { revokeEntitlement } from '@/features/admin/actions/revoke-entitlement';
import type { EntitlementOverride } from '@/features/admin/types';
import { formatDate } from '@/lib/dates';

export interface EntitlementManagerProps {
  /** Tenant the exceptions belong to. */
  companyId: string;
  /** Exceptions already in force. */
  overrides: readonly EntitlementOverride[];
}

/**
 * Renders the exception list and the form to add one.
 *
 * @param props The tenant and its exceptions.
 * @returns The rendered card.
 */
export function EntitlementManager({ companyId, overrides }: EntitlementManagerProps) {
  const router = useRouter();
  const [entitlementKey, setEntitlementKey] = useState('limits.monthly_invoices');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Grants or revises one exception.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);
    setFieldErrors({});

    const result = await grantEntitlement({ companyId, entitlementKey, value, reason });
    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success('The exception is in force straight away.');
    setValue('');
    setReason('');
    router.refresh();
  }

  /**
   * Withdraws one exception.
   *
   * @param override Exception being withdrawn.
   * @returns Nothing.
   */
  async function withdraw(override: EntitlementOverride): Promise<void> {
    setBusyId(override.id);
    setFailure(null);

    const result = await revokeEntitlement({ overrideId: override.id, companyId });
    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success('The tenant is back on its plan for that item.');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exceptions to the plan</CardTitle>
        <CardDescription>
          An exception overrides one limit or unlocks one module for this business alone. Use a
          whole number for a limit, true or false for a module, or the word unlimited.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {failure ? (
          <Alert tone="danger" title="That exception was not saved">
            {failure}
          </Alert>
        ) : null}

        {overrides.length === 0 ? (
          <EmptyState
            title="This business is on its plan exactly"
            description="Nothing has been granted beyond what the plan already allows."
          />
        ) : (
          <ul className="space-y-3">
            {overrides.map((override) => (
              <li
                key={override.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {override.entitlementKey} = {override.value}
                  </p>
                  <p className="text-sm text-muted-foreground">{override.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    Granted {formatDate(override.createdAt)}
                    {override.expiresAt ? `, expires ${formatDate(override.expiresAt)}` : ''}
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  isLoading={busyId === override.id}
                  loadingLabel="Withdrawing"
                  onClick={() => {
                    void withdraw(override);
                  }}
                >
                  Withdraw
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={onSubmit} className="space-y-4 border-t border-border pt-4" noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              id="entitlement-key"
              label="Entitlement"
              hint="For example limits.monthly_invoices or features.inventory."
              errors={fieldErrors['entitlementKey'] ?? []}
              isRequired
            >
              <Input
                {...fieldAccessibilityProps(
                  'entitlement-key',
                  true,
                  (fieldErrors['entitlementKey'] ?? []).length > 0
                )}
                value={entitlementKey}
                spellCheck={false}
                onChange={(event) => {
                  setEntitlementKey(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="entitlement-value"
              label="Value"
              hint="A whole number, true, false, or unlimited."
              errors={fieldErrors['value'] ?? []}
              isRequired
            >
              <Input
                {...fieldAccessibilityProps(
                  'entitlement-value',
                  true,
                  (fieldErrors['value'] ?? []).length > 0
                )}
                value={value}
                spellCheck={false}
                onChange={(event) => {
                  setValue(event.target.value);
                }}
              />
            </FormField>
          </div>

          <FormField
            id="entitlement-reason"
            label="Reason"
            hint="Kept on the record so the next person understands the decision."
            errors={fieldErrors['reason'] ?? []}
            isRequired
          >
            <Input
              {...fieldAccessibilityProps(
                'entitlement-reason',
                true,
                (fieldErrors['reason'] ?? []).length > 0
              )}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
            />
          </FormField>

          <Button type="submit" isLoading={isSaving} loadingLabel="Granting">
            Grant exception
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
