// src/components/settings/accountant-access-manager.tsx
// Where an owner decides who may read the books. The list shows when each
// accountant last looked, because knowing that is half the reason to keep
// the list at all.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { grantAccountantAccess } from '@/features/accountants/actions/grant-access';
import { revokeAccountantAccess } from '@/features/accountants/actions/revoke-access';
import type { AccountantGrant } from '@/features/accountants/types';
import { formatDate, formatDateTime } from '@/lib/dates';
import { humanise } from '@/lib/format';

export interface AccountantAccessManagerProps {
  /** Grants already given on this business. */
  grants: readonly AccountantGrant[];
  /** False when the business is suspended and nothing may be changed. */
  isWritable: boolean;
}

const SCOPE_CHOICES = [
  { key: 'accounting', label: 'Ledger and journal' },
  { key: 'reports', label: 'Reports and exports' },
  { key: 'expenses', label: 'Expenses and receipts' },
  { key: 'invoices', label: 'Invoices, read only' },
] as const;

type ScopeKey = (typeof SCOPE_CHOICES)[number]['key'];

/**
 * Picks the badge tone matching the state of a grant.
 *
 * @param status State of the grant.
 * @returns The tone to render.
 */
function toneForStatus(status: string): 'success' | 'neutral' | 'danger' {
  if (status === 'active') {
    return 'success';
  }

  if (status === 'revoked') {
    return 'danger';
  }

  return 'neutral';
}

/**
 * Renders the accountant access panel.
 *
 * @param props The grants and whether the business may be changed.
 * @returns The rendered card.
 */
export function AccountantAccessManager({ grants, isWritable }: AccountantAccessManagerProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [scopes, setScopes] = useState<ScopeKey[]>(['accounting', 'reports', 'expenses']);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Turns one scope on or off.
   *
   * @param scope Scope being changed.
   * @param isChecked True when the scope should be granted.
   * @returns Nothing.
   */
  function toggleScope(scope: ScopeKey, isChecked: boolean): void {
    setScopes((current) => {
      if (isChecked) {
        return current.includes(scope) ? current : [...current, scope];
      }

      return current.filter((entry) => entry !== scope);
    });
  }

  /**
   * Grants access to the accountant named in the form.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (scopes.length === 0) {
      setFailure('Choose at least one thing the accountant may see.');

      return;
    }

    setIsSaving(true);
    setFailure(null);

    const result = await grantAccountantAccess({
      email,
      scopes,
      expiresAt: expiresAt.length > 0 ? expiresAt : null,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success(`${result.data.accountantName} can now read your books.`);
    setEmail('');
    setExpiresAt('');
    router.refresh();
  }

  /**
   * Takes access back from one accountant.
   *
   * @param grantId Grant being withdrawn.
   * @returns Nothing.
   */
  async function onRevoke(grantId: string): Promise<void> {
    setBusyId(grantId);
    setFailure(null);

    const result = await revokeAccountantAccess({ grantId, reason: 'Withdrawn by the owner' });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('That accountant can no longer read your books.');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your accountant</CardTitle>
        <CardDescription>
          An accountant reads your ledger and reports and posts journal entries. They never send
          anything to your clients and they never see your payment keys.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {failure === null ? null : (
          <Alert tone="danger" title="That did not work">
            {failure}
          </Alert>
        )}

        {isWritable ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="accountant-email"
                label="Accountant email address"
                hint="They need an accountant login on the platform already."
                isRequired
              >
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  {...fieldAccessibilityProps('accountant-email', true, false)}
                />
              </FormField>

              <FormField
                id="accountant-expires"
                label="Access ends on"
                hint="Leave empty to keep the access open until you withdraw it."
              >
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  {...fieldAccessibilityProps('accountant-expires', true, false)}
                />
              </FormField>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">What they may see</legend>

              <div className="grid gap-2 sm:grid-cols-2">
                {SCOPE_CHOICES.map((choice) => (
                  <Checkbox
                    key={choice.key}
                    label={choice.label}
                    checked={scopes.includes(choice.key)}
                    onChange={(event) => toggleScope(choice.key, event.target.checked)}
                  />
                ))}
              </div>
            </fieldset>

            <Button type="submit" isLoading={isSaving} loadingLabel="Granting access">
              Grant access
            </Button>
          </form>
        ) : (
          <Alert tone="warning" title="This business is read only">
            Access can be changed again once the account is active.
          </Alert>
        )}

        {grants.length === 0 ? (
          <EmptyState
            title="Nobody outside the business reads your books"
            description="Grant access above when your accountant is ready, and withdraw it here the moment the work is finished."
          />
        ) : (
          <Table caption="Accountants with access to your books">
            <TableHeader>
              <TableRow>
                <TableHead>Accountant</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Granted</TableHead>
                <TableHead>Last opened</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grants.map((grant) => (
                <TableRow key={grant.id}>
                  <TableCell>
                    <span className="font-medium text-foreground">{grant.fullName}</span>
                    <p className="text-xs text-muted-foreground">{grant.email}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {grant.scopes.map((scope) => (
                        <Badge key={scope} tone="neutral">
                          {humanise(scope)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatDate(grant.grantedAt)}
                    {grant.expiresAt === null ? '' : ` until ${formatDate(grant.expiresAt)}`}
                  </TableCell>
                  <TableCell>
                    {grant.lastAccessedAt === null
                      ? 'Not yet'
                      : formatDateTime(grant.lastAccessedAt)}
                  </TableCell>
                  <TableCell>
                    <Badge tone={toneForStatus(grant.status)}>{humanise(grant.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    {grant.status === 'active' && isWritable ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        isLoading={busyId === grant.id}
                        loadingLabel="Withdrawing"
                        onClick={() => {
                          void onRevoke(grant.id);
                        }}
                      >
                        Withdraw
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">Nothing to do</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
