// src/components/admin/plan-editor.tsx
// Creating and revising one plan: what it is called, what it unlocks, what
// it limits and what the platform keeps when it collects on a tenant behalf.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { savePlan } from '@/features/admin/actions/save-plan';
import type { AdminPlan } from '@/features/admin/queries/list-plans';

export interface PlanEditorProps {
  /** The plan being revised, or null when a new one is being created. */
  plan: AdminPlan | null;
  /** True while the dialog is shown. */
  isOpen: boolean;
  /** Called when the dialog asks to be closed. */
  onClose: () => void;
}

/**
 * Turns a limits document into one line per limit.
 *
 * @param limits Limits of the plan.
 * @returns The lines shown in the form.
 */
function limitsToText(limits: Readonly<Record<string, number | null>>): string {
  return Object.entries(limits)
    .map(([key, value]) => `${key}=${value === null ? 'unlimited' : value}`)
    .join('\n');
}

/**
 * Turns a features document into one line per module.
 *
 * @param features Modules of the plan.
 * @returns The lines shown in the form.
 */
function featuresToText(features: Readonly<Record<string, boolean>>): string {
  return Object.entries(features)
    .map(([key, value]) => `${key}=${value ? 'true' : 'false'}`)
    .join('\n');
}

/**
 * Renders the plan form.
 *
 * @param props The plan being edited and the dialog state.
 * @returns The rendered dialog.
 */
export function PlanEditor({ plan, isOpen, onClose }: PlanEditorProps) {
  const router = useRouter();
  const [planKey, setPlanKey] = useState(plan?.planKey ?? '');
  const [name, setName] = useState(plan?.name ?? '');
  const [tagline, setTagline] = useState(plan?.tagline ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [badgeLabel, setBadgeLabel] = useState(plan?.badgeLabel ?? '');
  const [isFree, setIsFree] = useState(plan?.isFree ?? false);
  const [isPublic, setIsPublic] = useState(plan?.isPublic ?? true);
  const [isArchived, setIsArchived] = useState(plan?.isArchived ?? false);
  const [trialDays, setTrialDays] = useState(String(plan?.trialDays ?? 0));
  const [displayOrder, setDisplayOrder] = useState(String(plan?.displayOrder ?? 0));
  const [feePercentage, setFeePercentage] = useState(plan?.merchantFeePercentage ?? '0');
  const [feeFixed, setFeeFixed] = useState(plan?.merchantFeeFixed ?? '0');
  const [limits, setLimits] = useState(plan ? limitsToText(plan.limits) : '');
  const [features, setFeatures] = useState(plan ? featuresToText(plan.features) : '');
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Writes the plan.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);
    setFieldErrors({});

    const result = await savePlan({
      ...(plan ? { planId: plan.id } : {}),
      planKey,
      name,
      tagline,
      description,
      badgeLabel,
      isFree,
      isPublic,
      isArchived,
      trialDays,
      displayOrder,
      merchantFeePercentage: feePercentage,
      merchantFeeFixed: feeFixed,
      limits,
      features,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success(plan ? 'The plan was updated.' : 'The plan is ready to sell.');
    onClose();
    router.refresh();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={plan ? `Edit ${plan.name}` : 'New plan'}
      description="Limits and modules are written one per line, so a new limit can be introduced without changing any code."
      size="xl"
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {failure ? (
          <Alert tone="danger" title="That plan was not saved">
            {failure}
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            id="plan-key"
            label="Key"
            hint="Used in code and in the pricing page, for example professional."
            errors={fieldErrors['planKey'] ?? []}
            isRequired
          >
            <Input
              {...fieldAccessibilityProps(
                'plan-key',
                true,
                (fieldErrors['planKey'] ?? []).length > 0
              )}
              value={planKey}
              spellCheck={false}
              onChange={(event) => {
                setPlanKey(event.target.value);
              }}
            />
          </FormField>

          <FormField id="plan-name" label="Name" errors={fieldErrors['name'] ?? []} isRequired>
            <Input
              {...fieldAccessibilityProps(
                'plan-name',
                false,
                (fieldErrors['name'] ?? []).length > 0
              )}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </FormField>

          <FormField id="plan-tagline" label="Tagline" errors={fieldErrors['tagline'] ?? []}>
            <Input
              {...fieldAccessibilityProps('plan-tagline', false, false)}
              value={tagline}
              onChange={(event) => {
                setTagline(event.target.value);
              }}
            />
          </FormField>

          <FormField id="plan-badge" label="Badge" errors={fieldErrors['badgeLabel'] ?? []}>
            <Input
              {...fieldAccessibilityProps('plan-badge', false, false)}
              value={badgeLabel}
              onChange={(event) => {
                setBadgeLabel(event.target.value);
              }}
            />
          </FormField>

          <FormField id="plan-trial" label="Trial days" errors={fieldErrors['trialDays'] ?? []}>
            <Input
              {...fieldAccessibilityProps('plan-trial', false, false)}
              type="number"
              min={0}
              max={90}
              value={trialDays}
              onChange={(event) => {
                setTrialDays(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="plan-order"
            label="Display order"
            errors={fieldErrors['displayOrder'] ?? []}
          >
            <Input
              {...fieldAccessibilityProps('plan-order', false, false)}
              type="number"
              min={0}
              max={999}
              value={displayOrder}
              onChange={(event) => {
                setDisplayOrder(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="plan-fee-percentage"
            label="Collection fee percentage"
            hint="Kept from every payment the platform collects for the tenant."
            errors={fieldErrors['merchantFeePercentage'] ?? []}
          >
            <Input
              {...fieldAccessibilityProps('plan-fee-percentage', true, false)}
              type="number"
              step="0.01"
              min={0}
              value={feePercentage}
              onChange={(event) => {
                setFeePercentage(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="plan-fee-fixed"
            label="Collection fee per transaction"
            errors={fieldErrors['merchantFeeFixed'] ?? []}
          >
            <Input
              {...fieldAccessibilityProps('plan-fee-fixed', false, false)}
              type="number"
              step="0.01"
              min={0}
              value={feeFixed}
              onChange={(event) => {
                setFeeFixed(event.target.value);
              }}
            />
          </FormField>
        </div>

        <FormField
          id="plan-description"
          label="Description"
          errors={fieldErrors['description'] ?? []}
        >
          <Textarea
            {...fieldAccessibilityProps('plan-description', false, false)}
            rows={2}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
          />
        </FormField>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            id="plan-limits"
            label="Limits"
            hint="One per line, for example monthly_invoices=50 or team_members=unlimited."
            errors={fieldErrors['limits'] ?? []}
          >
            <Textarea
              {...fieldAccessibilityProps(
                'plan-limits',
                true,
                (fieldErrors['limits'] ?? []).length > 0
              )}
              rows={6}
              value={limits}
              spellCheck={false}
              onChange={(event) => {
                setLimits(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="plan-features"
            label="Modules"
            hint="One per line, for example inventory=true or projects=false."
            errors={fieldErrors['features'] ?? []}
          >
            <Textarea
              {...fieldAccessibilityProps(
                'plan-features',
                true,
                (fieldErrors['features'] ?? []).length > 0
              )}
              rows={6}
              value={features}
              spellCheck={false}
              onChange={(event) => {
                setFeatures(event.target.value);
              }}
            />
          </FormField>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Checkbox
            id="plan-free"
            label="Free plan"
            description="Never charged, and the fallback when a paid plan ends."
            checked={isFree}
            onChange={(event) => {
              setIsFree(event.target.checked);
            }}
          />
          <Checkbox
            id="plan-public"
            label="Shown on the pricing page"
            checked={isPublic}
            onChange={(event) => {
              setIsPublic(event.target.checked);
            }}
          />
          <Checkbox
            id="plan-archived"
            label="Archived"
            description="Hidden from everyone new, kept for the businesses already on it."
            checked={isArchived}
            onChange={(event) => {
              setIsArchived(event.target.checked);
            }}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving} loadingLabel="Saving">
            {plan ? 'Save plan' : 'Create plan'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
