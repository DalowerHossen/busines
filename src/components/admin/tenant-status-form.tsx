// src/components/admin/tenant-status-form.tsx
// Moving one tenant between states. Suspension and closure both ask for a
// reason, because that reason is what the business is told.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { setCompanyStatus } from '@/features/admin/actions/set-company-status';
import { humanise } from '@/lib/format';
import type { SelectOption } from '@/types/common';
import { COMPANY_STATUSES, type CompanyStatus } from '@/types/enums';

export interface TenantStatusFormProps {
  /** Tenant being changed. */
  companyId: string;
  /** State the tenant is in today. */
  status: CompanyStatus;
  /** Reason kept from the last suspension, when there is one. */
  suspensionReason: string | null;
}

const STATUS_OPTIONS: readonly SelectOption[] = COMPANY_STATUSES.map((status) => ({
  value: status,
  label: humanise(status),
}));

/**
 * Renders the state form for one tenant.
 *
 * @param props The tenant and its current state.
 * @returns The rendered card.
 */
export function TenantStatusForm({ companyId, status, suspensionReason }: TenantStatusFormProps) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState<CompanyStatus>(status);
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [reasonErrors, setReasonErrors] = useState<readonly string[]>([]);

  const needsReason = nextStatus === 'suspended' || nextStatus === 'closed';

  /**
   * Sends the new state to the server.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);
    setReasonErrors([]);

    const result = await setCompanyStatus({ companyId, status: nextStatus, reason });
    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      setReasonErrors(result.fieldErrors?.reason ?? []);
      return;
    }

    notify.success(`This business is now ${humanise(result.data.status).toLowerCase()}.`);
    setReason('');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>State of this business</CardTitle>
        <CardDescription>
          Suspending stops the business using the product but deletes nothing. Closing is the end of
          the relationship, and the records stay readable for the retention period.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {failure ? (
            <Alert tone="danger" title="That change was not saved">
              {failure}
            </Alert>
          ) : null}

          {suspensionReason ? (
            <Alert tone="warning" title="Currently suspended">
              {suspensionReason}
            </Alert>
          ) : null}

          <FormField id="tenant-next-status" label="Move this business to" isRequired>
            <Select
              {...fieldAccessibilityProps('tenant-next-status', false, false)}
              options={STATUS_OPTIONS}
              value={nextStatus}
              onChange={(event) => {
                setNextStatus(event.target.value as CompanyStatus);
              }}
            />
          </FormField>

          <FormField
            id="tenant-status-reason"
            label="Reason"
            hint="Written to the audit trail and used in the message the business receives."
            errors={reasonErrors}
            isRequired={needsReason}
          >
            <Textarea
              {...fieldAccessibilityProps('tenant-status-reason', true, reasonErrors.length > 0)}
              rows={3}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
            />
          </FormField>

          <Button
            type="submit"
            variant={needsReason ? 'destructive' : 'primary'}
            isLoading={isSaving}
            loadingLabel="Saving"
            disabled={nextStatus === status}
          >
            Apply this state
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
