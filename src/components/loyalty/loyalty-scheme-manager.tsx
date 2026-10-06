// src/components/loyalty/loyalty-scheme-manager.tsx
// Setting up the scheme and deciding what points buy. The earning rate and
// the value of a point are shown together, because one without the other
// tells you nothing about what the scheme costs.

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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { saveLoyaltyProgram } from '@/features/loyalty/actions/save-program';
import { saveLoyaltyReward } from '@/features/loyalty/actions/save-reward';
import { setLoyaltyRewardActive } from '@/features/loyalty/actions/set-reward-active';
import type { LoyaltyProgram, LoyaltyReward } from '@/features/loyalty/types';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface LoyaltySchemeManagerProps {
  /** The scheme on file, if there is one. */
  program: LoyaltyProgram | null;
  /** What points currently buy. */
  rewards: readonly LoyaltyReward[];
  /** Currency the business bills in. */
  currency: string;
  /** True when the viewer may change the scheme. */
  canManage: boolean;
}

interface SchemeForm {
  name: string;
  description: string;
  isActive: boolean;
  pointsPerCurrencyUnit: string;
  earnOn: string;
  minimumSpend: string;
  pointValue: string;
  minimumRedemptionPoints: string;
  redemptionMultiple: string;
  pointsExpireAfterMonths: string;
  silverThreshold: string;
  goldThreshold: string;
  platinumThreshold: string;
  termsUrl: string;
}

interface RewardForm {
  name: string;
  description: string;
  rewardType: string;
  pointsCost: string;
  creditAmount: string;
  discountPercentage: string;
  minimumTier: string;
  perMemberLimit: string;
  displayOrder: string;
}

const EARN_OPTIONS = [
  { value: 'payment', label: 'Every payment received' },
  { value: 'invoice_paid', label: 'An invoice settled in full' },
  { value: 'subscription_renewal', label: 'A subscription renewing' },
  { value: 'referral', label: 'A client introducing another' },
  { value: 'manual', label: 'Only when somebody awards them' },
];

const REWARD_TYPE_OPTIONS = [
  { value: 'invoice_credit', label: 'Money off an invoice' },
  { value: 'percentage_discount', label: 'A percentage discount' },
  { value: 'free_product', label: 'Something from your catalogue' },
  { value: 'service_upgrade', label: 'An upgrade to the service' },
  { value: 'donation', label: 'A donation in their name' },
];

const TIER_OPTIONS = [
  { value: 'standard', label: 'Everybody' },
  { value: 'silver', label: 'Silver and above' },
  { value: 'gold', label: 'Gold and above' },
  { value: 'platinum', label: 'Platinum only' },
];

const EMPTY_REWARD: RewardForm = {
  name: '',
  description: '',
  rewardType: 'invoice_credit',
  pointsCost: '500',
  creditAmount: '25',
  discountPercentage: '',
  minimumTier: 'standard',
  perMemberLimit: '',
  displayOrder: '0',
};

/**
 * Builds the opening state of the scheme form.
 *
 * @param program The scheme on file, if there is one.
 * @returns The form state.
 */
function toSchemeForm(program: LoyaltyProgram | null): SchemeForm {
  return {
    name: program?.name ?? 'Client rewards',
    description: program?.description ?? '',
    isActive: program?.isActive ?? true,
    pointsPerCurrencyUnit: program?.pointsPerCurrencyUnit ?? '1',
    earnOn: program?.earnOn ?? 'payment',
    minimumSpend: program?.minimumSpend ?? '0',
    pointValue: program?.pointValue ?? '0.01',
    minimumRedemptionPoints: String(program?.minimumRedemptionPoints ?? 100),
    redemptionMultiple: String(program?.redemptionMultiple ?? 100),
    pointsExpireAfterMonths:
      program?.pointsExpireAfterMonths === null || program?.pointsExpireAfterMonths === undefined
        ? ''
        : String(program.pointsExpireAfterMonths),
    silverThreshold:
      program?.silverThreshold === null ? '' : String(program?.silverThreshold ?? ''),
    goldThreshold: program?.goldThreshold === null ? '' : String(program?.goldThreshold ?? ''),
    platinumThreshold:
      program?.platinumThreshold === null ? '' : String(program?.platinumThreshold ?? ''),
    termsUrl: program?.termsUrl ?? '',
  };
}

/**
 * Renders the scheme screen.
 *
 * @param props The scheme, the rewards and what the viewer may do.
 * @returns The rendered screen.
 */
export function LoyaltySchemeManager({
  program,
  rewards,
  currency,
  canManage,
}: LoyaltySchemeManagerProps) {
  const router = useRouter();
  const [scheme, setScheme] = useState<SchemeForm>(() => toSchemeForm(program));
  const [reward, setReward] = useState<RewardForm>(EMPTY_REWARD);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [isSavingScheme, setIsSavingScheme] = useState(false);
  const [isSavingReward, setIsSavingReward] = useState(false);
  const [schemeFailure, setSchemeFailure] = useState<string | null>(null);
  const [rewardFailure, setRewardFailure] = useState<string | null>(null);
  const [schemeErrors, setSchemeErrors] = useState<Record<string, readonly string[]>>({});
  const [rewardErrors, setRewardErrors] = useState<Record<string, readonly string[]>>({});

  /**
   * Changes one field of the scheme form.
   *
   * @param key Field being changed.
   * @param value New value.
   * @returns Nothing.
   */
  function onSchemeChange(key: keyof SchemeForm, value: string | boolean): void {
    setScheme((current) => ({ ...current, [key]: value }));
  }

  /**
   * Changes one field of the reward form.
   *
   * @param key Field being changed.
   * @param value New value.
   * @returns Nothing.
   */
  function onRewardChange(key: keyof RewardForm, value: string): void {
    setReward((current) => ({ ...current, [key]: value }));
  }

  /**
   * Saves the scheme.
   *
   * @param event The submitted form.
   * @returns Nothing.
   */
  async function onSubmitScheme(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSavingScheme(true);
    setSchemeFailure(null);
    setSchemeErrors({});

    const result = await saveLoyaltyProgram({
      programId: program?.programId,
      name: scheme.name,
      description: scheme.description.trim() === '' ? undefined : scheme.description.trim(),
      isActive: scheme.isActive,
      pointsPerCurrencyUnit: scheme.pointsPerCurrencyUnit,
      earnOn: scheme.earnOn,
      minimumSpend: scheme.minimumSpend,
      pointValue: scheme.pointValue,
      minimumRedemptionPoints: scheme.minimumRedemptionPoints,
      redemptionMultiple: scheme.redemptionMultiple,
      pointsExpireAfterMonths:
        scheme.pointsExpireAfterMonths.trim() === '' ? undefined : scheme.pointsExpireAfterMonths,
      silverThreshold: scheme.silverThreshold.trim() === '' ? undefined : scheme.silverThreshold,
      goldThreshold: scheme.goldThreshold.trim() === '' ? undefined : scheme.goldThreshold,
      platinumThreshold:
        scheme.platinumThreshold.trim() === '' ? undefined : scheme.platinumThreshold,
      termsUrl: scheme.termsUrl.trim() === '' ? undefined : scheme.termsUrl.trim(),
      currency,
    });

    setIsSavingScheme(false);

    if (!result.success) {
      setSchemeFailure(result.error);
      setSchemeErrors(result.fieldErrors ?? {});

      return;
    }

    notify.success('The scheme is saved.');
    router.refresh();
  }

  /**
   * Saves one reward.
   *
   * @param event The submitted form.
   * @returns Nothing.
   */
  async function onSubmitReward(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (program === null) {
      setRewardFailure('Save the scheme before deciding what points buy.');

      return;
    }

    setIsSavingReward(true);
    setRewardFailure(null);
    setRewardErrors({});

    const result = await saveLoyaltyReward({
      programId: program.programId,
      rewardId: editingRewardId ?? undefined,
      name: reward.name,
      description: reward.description.trim() === '' ? undefined : reward.description.trim(),
      rewardType: reward.rewardType,
      pointsCost: reward.pointsCost,
      creditAmount:
        reward.rewardType === 'invoice_credit' && reward.creditAmount.trim() !== ''
          ? reward.creditAmount
          : undefined,
      discountPercentage:
        reward.rewardType === 'percentage_discount' && reward.discountPercentage.trim() !== ''
          ? reward.discountPercentage
          : undefined,
      minimumTier: reward.minimumTier,
      perMemberLimit: reward.perMemberLimit.trim() === '' ? undefined : reward.perMemberLimit,
      displayOrder: reward.displayOrder,
    });

    setIsSavingReward(false);

    if (!result.success) {
      setRewardFailure(result.error);
      setRewardErrors(result.fieldErrors ?? {});

      return;
    }

    notify.success(editingRewardId === null ? 'That reward is live.' : 'That reward is updated.');
    setReward(EMPTY_REWARD);
    setEditingRewardId(null);
    router.refresh();
  }

  /**
   * Loads one reward into the form.
   *
   * @param existing Reward being edited.
   * @returns Nothing.
   */
  function onEditReward(existing: LoyaltyReward): void {
    setEditingRewardId(existing.rewardId);
    setRewardFailure(null);
    setRewardErrors({});
    setReward({
      name: existing.name,
      description: existing.description ?? '',
      rewardType: existing.rewardType,
      pointsCost: String(existing.pointsCost),
      creditAmount: existing.creditAmount ?? '',
      discountPercentage: existing.discountPercentage ?? '',
      minimumTier: existing.minimumTier,
      perMemberLimit: existing.perMemberLimit === null ? '' : String(existing.perMemberLimit),
      displayOrder: String(existing.displayOrder),
    });
  }

  /**
   * Withdraws a reward or offers it again.
   *
   * @param rewardId Reward being switched.
   * @param isActive True when it should be offered.
   * @returns Nothing.
   */
  async function onToggleReward(rewardId: string, isActive: boolean): Promise<void> {
    const result = await setLoyaltyRewardActive({ rewardId, isActive });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success(isActive ? 'That reward is on offer again.' : 'That reward is withdrawn.');
    router.refresh();
  }

  const earnRate = Number.parseFloat(scheme.pointsPerCurrencyUnit);
  const unitValue = Number.parseFloat(scheme.pointValue);
  const costPerUnit =
    Number.isFinite(earnRate) && Number.isFinite(unitValue) ? earnRate * unitValue * 100 : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>How points are earned and what they are worth</CardTitle>
          <CardDescription>
            {`At these settings the scheme gives back ${costPerUnit.toFixed(
              2
            )} percent of everything your clients spend.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void onSubmitScheme(event)} noValidate>
            {schemeFailure === null ? null : (
              <Alert tone="danger" title="The scheme was not saved">
                {schemeFailure}
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="scheme-name"
                label="Name of the scheme"
                isRequired
                errors={schemeErrors.name}
              >
                <Input
                  id="scheme-name"
                  value={scheme.name}
                  disabled={!canManage}
                  onChange={(event) => onSchemeChange('name', event.target.value)}
                />
              </FormField>

              <FormField id="scheme-earn-on" label="Points are earned on">
                <Select
                  id="scheme-earn-on"
                  value={scheme.earnOn}
                  options={EARN_OPTIONS}
                  disabled={!canManage}
                  onChange={(event) => onSchemeChange('earnOn', event.target.value)}
                />
              </FormField>

              <FormField
                id="scheme-rate"
                label={`Points earned for each ${currency} spent`}
                errors={schemeErrors.pointsPerCurrencyUnit}
              >
                <Input
                  id="scheme-rate"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={scheme.pointsPerCurrencyUnit}
                  disabled={!canManage}
                  onChange={(event) => onSchemeChange('pointsPerCurrencyUnit', event.target.value)}
                />
              </FormField>

              <FormField
                id="scheme-value"
                label={`What one point is worth in ${currency}`}
                errors={schemeErrors.pointValue}
              >
                <Input
                  id="scheme-value"
                  type="number"
                  min={0.000001}
                  step={0.001}
                  value={scheme.pointValue}
                  disabled={!canManage}
                  onChange={(event) => onSchemeChange('pointValue', event.target.value)}
                />
              </FormField>

              <FormField
                id="scheme-minimum-spend"
                label={`Smallest spend that earns, in ${currency}`}
              >
                <Input
                  id="scheme-minimum-spend"
                  type="number"
                  min={0}
                  step={0.01}
                  value={scheme.minimumSpend}
                  disabled={!canManage}
                  onChange={(event) => onSchemeChange('minimumSpend', event.target.value)}
                />
              </FormField>

              <FormField id="scheme-minimum-redemption" label="Fewest points that can be spent">
                <Input
                  id="scheme-minimum-redemption"
                  type="number"
                  min={1}
                  value={scheme.minimumRedemptionPoints}
                  disabled={!canManage}
                  onChange={(event) =>
                    onSchemeChange('minimumRedemptionPoints', event.target.value)
                  }
                />
              </FormField>

              <FormField id="scheme-multiple" label="Points are spent in multiples of">
                <Input
                  id="scheme-multiple"
                  type="number"
                  min={1}
                  value={scheme.redemptionMultiple}
                  disabled={!canManage}
                  onChange={(event) => onSchemeChange('redemptionMultiple', event.target.value)}
                />
              </FormField>

              <FormField
                id="scheme-expiry"
                label="Points expire after this many months"
                hint="Leave empty if points never expire."
              >
                <Input
                  id="scheme-expiry"
                  type="number"
                  min={1}
                  max={120}
                  value={scheme.pointsExpireAfterMonths}
                  disabled={!canManage}
                  onChange={(event) =>
                    onSchemeChange('pointsExpireAfterMonths', event.target.value)
                  }
                />
              </FormField>

              <FormField id="scheme-silver" label="Points needed for silver">
                <Input
                  id="scheme-silver"
                  type="number"
                  min={1}
                  value={scheme.silverThreshold}
                  disabled={!canManage}
                  onChange={(event) => onSchemeChange('silverThreshold', event.target.value)}
                />
              </FormField>

              <FormField id="scheme-gold" label="Points needed for gold">
                <Input
                  id="scheme-gold"
                  type="number"
                  min={1}
                  value={scheme.goldThreshold}
                  disabled={!canManage}
                  onChange={(event) => onSchemeChange('goldThreshold', event.target.value)}
                />
              </FormField>

              <FormField id="scheme-platinum" label="Points needed for platinum">
                <Input
                  id="scheme-platinum"
                  type="number"
                  min={1}
                  value={scheme.platinumThreshold}
                  disabled={!canManage}
                  onChange={(event) => onSchemeChange('platinumThreshold', event.target.value)}
                />
              </FormField>

              <FormField
                id="scheme-terms"
                label="Web address of your scheme terms"
                errors={schemeErrors.termsUrl}
              >
                <Input
                  id="scheme-terms"
                  type="url"
                  value={scheme.termsUrl}
                  placeholder="https://example.com/rewards-terms"
                  disabled={!canManage}
                  onChange={(event) => onSchemeChange('termsUrl', event.target.value)}
                />
              </FormField>
            </div>

            <FormField id="scheme-description" label="What members are told">
              <Textarea
                id="scheme-description"
                rows={3}
                value={scheme.description}
                disabled={!canManage}
                placeholder="Collect a point for every unit you spend and take money off a future invoice."
                onChange={(event) => onSchemeChange('description', event.target.value)}
              />
            </FormField>

            {canManage ? (
              <div className="flex flex-wrap items-center gap-4">
                <Switch
                  checked={scheme.isActive}
                  label="The scheme is running"
                  onCheckedChange={(checked) => onSchemeChange('isActive', checked)}
                />
                <Button type="submit" isLoading={isSavingScheme} loadingLabel="Saving">
                  {program === null ? 'Start the scheme' : 'Save the scheme'}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Only the account owner can change how points are earned.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What points buy</CardTitle>
          <CardDescription>
            A scheme with nothing to spend points on is a scheme nobody joins twice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rewards.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No rewards yet. Money off the next invoice is the simplest one to start with.
            </p>
          ) : (
            <ul className="space-y-3">
              {rewards.map((item) => (
                <li
                  key={item.rewardId}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.name}</p>
                      <Badge tone="neutral">{humanise(item.rewardType)}</Badge>
                      {item.minimumTier === 'standard' ? null : (
                        <Badge tone="warning">{`${humanise(item.minimumTier)} and above`}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {`${formatNumber(item.pointsCost)} points${
                        item.creditAmount === null
                          ? ''
                          : ` for ${formatMoney(item.creditAmount, currency)} off`
                      }${
                        item.discountPercentage === null
                          ? ''
                          : ` for ${item.discountPercentage}% off`
                      }. Claimed ${formatNumber(item.redeemedCount)} times.`}
                    </p>
                  </div>

                  {canManage ? (
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <Switch
                        checked={item.isActive}
                        label="Offered"
                        onCheckedChange={(checked) => void onToggleReward(item.rewardId, checked)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditReward(item)}
                      >
                        Change this reward
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {canManage ? (
            <form
              className="space-y-4 border-t border-border pt-4"
              onSubmit={(event) => void onSubmitReward(event)}
              noValidate
            >
              {rewardFailure === null ? null : (
                <Alert tone="danger" title="That reward was not saved">
                  {rewardFailure}
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="reward-name"
                  label="Name of the reward"
                  isRequired
                  errors={rewardErrors.name}
                >
                  <Input
                    id="reward-name"
                    value={reward.name}
                    placeholder="Twenty five off your next invoice"
                    onChange={(event) => onRewardChange('name', event.target.value)}
                  />
                </FormField>

                <FormField id="reward-type" label="What the member receives">
                  <Select
                    id="reward-type"
                    value={reward.rewardType}
                    options={REWARD_TYPE_OPTIONS}
                    onChange={(event) => onRewardChange('rewardType', event.target.value)}
                  />
                </FormField>

                <FormField
                  id="reward-cost"
                  label="Points it costs"
                  isRequired
                  errors={rewardErrors.pointsCost}
                >
                  <Input
                    id="reward-cost"
                    type="number"
                    min={1}
                    value={reward.pointsCost}
                    onChange={(event) => onRewardChange('pointsCost', event.target.value)}
                  />
                </FormField>

                {reward.rewardType === 'invoice_credit' ? (
                  <FormField
                    id="reward-credit"
                    label={`Credit in ${currency}`}
                    errors={rewardErrors.creditAmount}
                  >
                    <Input
                      id="reward-credit"
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={reward.creditAmount}
                      onChange={(event) => onRewardChange('creditAmount', event.target.value)}
                    />
                  </FormField>
                ) : null}

                {reward.rewardType === 'percentage_discount' ? (
                  <FormField
                    id="reward-discount"
                    label="Discount as a percentage"
                    errors={rewardErrors.discountPercentage}
                  >
                    <Input
                      id="reward-discount"
                      type="number"
                      min={0.01}
                      max={100}
                      step={0.01}
                      value={reward.discountPercentage}
                      onChange={(event) => onRewardChange('discountPercentage', event.target.value)}
                    />
                  </FormField>
                ) : null}

                <FormField id="reward-tier" label="Who may claim it">
                  <Select
                    id="reward-tier"
                    value={reward.minimumTier}
                    options={TIER_OPTIONS}
                    onChange={(event) => onRewardChange('minimumTier', event.target.value)}
                  />
                </FormField>

                <FormField
                  id="reward-limit"
                  label="Times one member may claim it"
                  hint="Leave empty for no limit."
                >
                  <Input
                    id="reward-limit"
                    type="number"
                    min={1}
                    value={reward.perMemberLimit}
                    onChange={(event) => onRewardChange('perMemberLimit', event.target.value)}
                  />
                </FormField>

                <FormField id="reward-order" label="Where it appears in the list">
                  <Input
                    id="reward-order"
                    type="number"
                    min={0}
                    value={reward.displayOrder}
                    onChange={(event) => onRewardChange('displayOrder', event.target.value)}
                  />
                </FormField>
              </div>

              <FormField id="reward-description" label="What the member is told">
                <Textarea
                  id="reward-description"
                  rows={2}
                  value={reward.description}
                  onChange={(event) => onRewardChange('description', event.target.value)}
                />
              </FormField>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" isLoading={isSavingReward} loadingLabel="Saving">
                  {editingRewardId === null ? 'Add this reward' : 'Save the change'}
                </Button>
                {editingRewardId === null ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingRewardId(null);
                      setReward(EMPTY_REWARD);
                    }}
                  >
                    Leave it as it was
                  </Button>
                )}
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
