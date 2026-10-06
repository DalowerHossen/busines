// src/components/admin/settlement-policy-manager.tsx
// The commercial dial of the whole platform.
//
// Four numbers decide whether this business makes money and whether sellers
// stay: the percentage kept from each payment, the floor under it, how long
// the money is held, and how fast a withdrawal is promised. They are edited
// here, they take effect on the next payment, and a deal agreed with one
// account sits beside the standard terms rather than replacing them.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { removeSettlementPolicy } from '@/features/settlements/actions/remove-policy';
import { saveSettlementPolicy } from '@/features/settlements/actions/save-policy';
import type { SettlementPolicyRow } from '@/features/settlements/queries/list-policies';
import { formatMoney, formatNumber } from '@/lib/format';

export interface SettlementPolicyManagerProps {
  /** The terms in force, the standard ones first. */
  policies: readonly SettlementPolicyRow[];
  /** Accounts a negotiated deal can be written for. */
  accounts: readonly { id: string; name: string }[];
}

interface PolicyForm {
  name: string;
  feePercentage: string;
  minimumFee: string;
  fixedFee: string;
  holdDays: string;
  payoutSlaHours: string;
  payoutThreshold: string;
  notes: string;
}

/**
 * Turns stored terms into the form the editor shows.
 *
 * @param policy The terms being edited, if any.
 * @returns The form values.
 */
function toForm(policy: SettlementPolicyRow | null): PolicyForm {
  return {
    name: policy?.name ?? 'Negotiated terms',
    feePercentage: policy === null ? '0.50' : Number(policy.feePercentage).toFixed(2),
    minimumFee: policy === null ? '0.50' : Number(policy.minimumFee).toFixed(2),
    fixedFee: policy === null ? '0.00' : Number(policy.fixedFee).toFixed(2),
    holdDays: String(policy?.holdDays ?? 7),
    payoutSlaHours: String(policy?.payoutSlaHours ?? 24),
    payoutThreshold: policy === null ? '25.00' : Number(policy.payoutThreshold).toFixed(2),
    notes: '',
  };
}

/**
 * Renders the editor for the collection terms.
 *
 * @param props The terms in force and the accounts available.
 * @returns The rendered manager.
 */
export function SettlementPolicyManager({ policies, accounts }: SettlementPolicyManagerProps) {
  const router = useRouter();
  const standard = policies.find((policy) => policy.companyId === null) ?? null;
  const negotiated = policies.filter((policy) => policy.companyId !== null);

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<PolicyForm>(toForm(standard));
  const [targetCompany, setTargetCompany] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Opens the editor against one set of terms.
   *
   * @param policy The terms, or null for a new negotiated deal.
   * @returns Nothing.
   */
  function openEditor(policy: SettlementPolicyRow | null): void {
    setEditing(policy === null ? 'new' : (policy.companyId ?? 'standard'));
    setForm(toForm(policy));
    setTargetCompany(policy?.companyId ?? '');
    setFieldErrors({});
  }

  /**
   * Saves whatever is in the editor.
   *
   * @returns Nothing.
   */
  async function onSave(): Promise<void> {
    const companyId = editing === 'standard' ? null : targetCompany === '' ? null : targetCompany;

    if (editing !== 'standard' && companyId === null) {
      notify.error('Choose which account these terms are for.');

      return;
    }

    setIsSaving(true);
    setFieldErrors({});

    const result = await saveSettlementPolicy({
      companyId,
      name: form.name,
      feePercentage: form.feePercentage,
      minimumFee: form.minimumFee,
      fixedFee: form.fixedFee,
      holdDays: form.holdDays,
      payoutSlaHours: form.payoutSlaHours,
      payoutThreshold: form.payoutThreshold,
      notes: form.notes === '' ? undefined : form.notes,
    });

    setIsSaving(false);

    if (!result.success) {
      setFieldErrors(result.fieldErrors ?? {});
      notify.error(result.error);

      return;
    }

    notify.success('Saved. Every payment from now on is settled on these terms.');
    setEditing(null);
    router.refresh();
  }

  /**
   * Returns one account to the standard terms.
   *
   * @param companyId Account being dropped.
   * @returns Nothing.
   */
  async function onRemove(companyId: string): Promise<void> {
    const result = await removeSettlementPolicy({ companyId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('That account is back on the standard terms.');
    router.refresh();
  }

  const accountOptions = [
    { value: '', label: 'Choose an account' },
    ...accounts.map((account) => ({ value: account.id, label: account.name })),
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Standard collection terms</CardTitle>
          <CardDescription>
            Applied to every account that has no deal of its own. A change here reaches the next
            payment immediately; nothing already settled is touched.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {standard === null ? (
            <Alert tone="danger" title="No standard terms are configured">
              Payments cannot be settled until standard terms exist. Save a set below.
            </Alert>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div>
                <dt className="text-sm text-muted-foreground">Fee kept</dt>
                <dd className="tabular text-lg font-semibold">
                  {`${formatNumber(Number(standard.feePercentage), 2)}%`}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Minimum fee</dt>
                <dd className="tabular text-lg font-semibold">
                  {formatMoney(standard.minimumFee, 'USD')}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Hold period</dt>
                <dd className="tabular text-lg font-semibold">
                  {`${formatNumber(standard.holdDays)} days`}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Withdrawal promise</dt>
                <dd className="tabular text-lg font-semibold">
                  {`${formatNumber(standard.payoutSlaHours)} hours`}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Minimum withdrawal</dt>
                <dd className="tabular text-lg font-semibold">
                  {formatMoney(standard.payoutThreshold, 'USD')}
                </dd>
              </div>
            </dl>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => openEditor(standard)}>Edit the standard terms</Button>
            <Button variant="secondary" onClick={() => openEditor(null)}>
              Agree terms with one account
            </Button>
          </div>
        </CardContent>
      </Card>

      {editing !== null ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {editing === 'standard' ? 'Editing the standard terms' : 'Terms for one account'}
            </CardTitle>
            <CardDescription>
              The fee is a percentage of what the client paid, with the minimum applied whenever the
              percentage comes out smaller. What the card network charges is separate and is never
              part of this figure.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing !== 'standard' ? (
              <FormField id="policy-company" label="Account" isRequired>
                <Select
                  id="policy-company"
                  value={targetCompany}
                  options={accountOptions}
                  onChange={(event) => setTargetCompany(event.target.value)}
                />
              </FormField>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="policy-name" label="Name" errors={fieldErrors['name']} isRequired>
                <Input
                  id="policy-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </FormField>

              <FormField
                id="policy-fee"
                label="Fee kept from each payment, as a percentage"
                hint="For example 0.30 or 0.50."
                errors={fieldErrors['feePercentage']}
                isRequired
              >
                <Input
                  id="policy-fee"
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={form.feePercentage}
                  onChange={(event) => setForm({ ...form, feePercentage: event.target.value })}
                />
              </FormField>

              <FormField
                id="policy-minimum"
                label="Minimum fee per payment"
                hint="Charged when the percentage comes out smaller than this."
                errors={fieldErrors['minimumFee']}
                isRequired
              >
                <Input
                  id="policy-minimum"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.minimumFee}
                  onChange={(event) => setForm({ ...form, minimumFee: event.target.value })}
                />
              </FormField>

              <FormField
                id="policy-fixed"
                label="Fixed amount added to every payment"
                hint="Leave at zero unless the percentage alone does not cover the cost."
                errors={fieldErrors['fixedFee']}
              >
                <Input
                  id="policy-fixed"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.fixedFee}
                  onChange={(event) => setForm({ ...form, fixedFee: event.target.value })}
                />
              </FormField>

              <FormField
                id="policy-hold"
                label="Hold period in days"
                hint="How long before a seller can withdraw what a client paid."
                errors={fieldErrors['holdDays']}
                isRequired
              >
                <Input
                  id="policy-hold"
                  type="number"
                  step="1"
                  min="0"
                  max="90"
                  value={form.holdDays}
                  onChange={(event) => setForm({ ...form, holdDays: event.target.value })}
                />
              </FormField>

              <FormField
                id="policy-sla"
                label="Withdrawal promise in hours"
                hint="The queue warns the money team before this runs out."
                errors={fieldErrors['payoutSlaHours']}
                isRequired
              >
                <Input
                  id="policy-sla"
                  type="number"
                  step="1"
                  min="1"
                  max="168"
                  value={form.payoutSlaHours}
                  onChange={(event) => setForm({ ...form, payoutSlaHours: event.target.value })}
                />
              </FormField>

              <FormField
                id="policy-threshold"
                label="Minimum withdrawal"
                hint="Keeps transfer costs sensible on small balances."
                errors={fieldErrors['payoutThreshold']}
                isRequired
              >
                <Input
                  id="policy-threshold"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.payoutThreshold}
                  onChange={(event) => setForm({ ...form, payoutThreshold: event.target.value })}
                />
              </FormField>
            </div>

            <FormField
              id="policy-notes"
              label="Why these terms"
              hint="Written to the audit trail with your name against it."
              errors={fieldErrors['notes']}
            >
              <Textarea
                id="policy-notes"
                rows={2}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </FormField>

            <div className="flex flex-wrap gap-2">
              <Button isLoading={isSaving} loadingLabel="Saving" onClick={() => void onSave()}>
                Save these terms
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Accounts on their own terms</CardTitle>
          <CardDescription>
            Deals agreed with individual accounts. Dropping one returns that account to the standard
            terms from its next payment onwards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {negotiated.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Every account is on the standard terms right now.
            </p>
          ) : (
            <ul className="space-y-3">
              {negotiated.map((policy) => (
                <li
                  key={policy.policyId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{policy.companyName ?? 'Unnamed account'}</p>
                    <p className="tabular text-sm text-muted-foreground">
                      {`${formatNumber(Number(policy.feePercentage), 2)}% with a minimum of ${formatMoney(
                        policy.minimumFee,
                        'USD'
                      )}, held ${formatNumber(policy.holdDays)} days, paid within ${formatNumber(
                        policy.payoutSlaHours
                      )} hours`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge tone="info">{policy.name}</Badge>
                    <Button variant="secondary" onClick={() => openEditor(policy)}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => void onRemove(policy.companyId ?? '')}>
                      Use standard terms
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
