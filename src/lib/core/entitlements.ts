import { featureDisabled, invalidCoreRequest, usageLimitExceeded } from './errors';
import type { EntitlementContext, EntitlementDecision, FeatureFlagDefinition } from './types';

export function evaluateEntitlement(input: {
  readonly featureKey: string;
  readonly context: EntitlementContext;
  readonly currentUsage?: number;
  readonly requestedUnits?: number;
  readonly now: string;
}): EntitlementDecision {
  const featureKey = input.featureKey.trim().toLowerCase();
  const requestedUnits = input.requestedUnits ?? 1;
  if (
    !isFeatureKey(featureKey) ||
    !Number.isFinite(Date.parse(input.now)) ||
    !Number.isSafeInteger(input.currentUsage ?? 0) ||
    (input.currentUsage ?? 0) < 0 ||
    !Number.isSafeInteger(requestedUnits) ||
    requestedUnits < 1
  ) {
    throw invalidCoreRequest();
  }
  const planEntitlement = input.context.planEntitlements.find(
    (entitlement) => entitlement.featureKey === featureKey
  );
  const flag = resolveFeatureFlag(input.context.featureFlags, featureKey, input.now);
  if (
    !input.context.bypassFeatureFlag &&
    (!flag || !isFlagEnabled(flag, input.context.companyId))
  ) {
    return denied(featureKey, 'feature_flag_disabled', planEntitlement?.limit ?? null);
  }
  if (!planEntitlement?.enabled) {
    return denied(featureKey, 'plan_not_entitled', planEntitlement?.limit ?? null);
  }
  if (
    input.context.subscriptionStatus !== 'trialing' &&
    input.context.subscriptionStatus !== 'active'
  ) {
    return denied(featureKey, 'subscription_inactive', planEntitlement.limit);
  }
  const limit = planEntitlement.limit;
  if (limit !== null && (input.currentUsage ?? 0) + requestedUnits > limit) {
    return denied(
      featureKey,
      'usage_limit_exceeded',
      limit,
      Math.max(0, limit - (input.currentUsage ?? 0))
    );
  }
  return {
    featureKey,
    allowed: true,
    reason: null,
    limit,
    remaining:
      limit === null ? null : Math.max(0, limit - (input.currentUsage ?? 0) - requestedUnits),
  };
}

export function assertEntitled(input: {
  readonly featureKey: string;
  readonly context: EntitlementContext;
  readonly currentUsage?: number;
  readonly requestedUnits?: number;
  readonly now: string;
}): EntitlementDecision {
  const decision = evaluateEntitlement(input);
  if (!decision.allowed) {
    if (decision.reason === 'usage_limit_exceeded') throw usageLimitExceeded();
    throw featureDisabled();
  }
  return decision;
}

export function validateFeatureFlag(flag: FeatureFlagDefinition): FeatureFlagDefinition {
  if (
    !isFeatureKey(flag.key) ||
    !Number.isFinite(flag.rolloutPercentage) ||
    flag.rolloutPercentage < 0 ||
    flag.rolloutPercentage > 100 ||
    (flag.effectiveFrom !== undefined && !Number.isFinite(Date.parse(flag.effectiveFrom))) ||
    (flag.effectiveUntil !== undefined && !Number.isFinite(Date.parse(flag.effectiveUntil))) ||
    (flag.effectiveFrom !== undefined &&
      flag.effectiveUntil !== undefined &&
      Date.parse(flag.effectiveUntil) <= Date.parse(flag.effectiveFrom))
  ) {
    throw invalidCoreRequest();
  }
  return { ...flag, key: flag.key.trim().toLowerCase() };
}

function resolveFeatureFlag(
  flags: readonly FeatureFlagDefinition[],
  featureKey: string,
  now: string
): FeatureFlagDefinition | null {
  return (
    flags
      .map(validateFeatureFlag)
      .filter((flag) => flag.key === featureKey)
      .filter(
        (flag) =>
          flag.effectiveFrom === undefined || Date.parse(flag.effectiveFrom) <= Date.parse(now)
      )
      .filter(
        (flag) =>
          flag.effectiveUntil === undefined || Date.parse(now) < Date.parse(flag.effectiveUntil)
      )
      .sort((left, right) => (left.effectiveFrom ?? '').localeCompare(right.effectiveFrom ?? ''))
      .at(-1) ?? null
  );
}

function isFlagEnabled(flag: FeatureFlagDefinition, companyId: string): boolean {
  if (!companyId.trim()) throw invalidCoreRequest();
  if (
    !flag.enabled ||
    (flag.allowedCompanyIds.length > 0 && !flag.allowedCompanyIds.includes(companyId))
  ) {
    return false;
  }
  if (flag.rolloutPercentage >= 100) return true;
  if (flag.rolloutPercentage <= 0) return false;
  return stableBucket(`${flag.key}:${companyId}`) < flag.rolloutPercentage * 100;
}

function stableBucket(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 10000;
}

function denied(
  featureKey: string,
  reason: EntitlementDecision['reason'],
  limit: number | null,
  remaining: number | null = null
): EntitlementDecision {
  return { featureKey, allowed: false, reason, limit, remaining };
}

function isFeatureKey(value: string): boolean {
  return /^[a-z][a-z0-9_.-]{1,127}$/u.test(value.trim().toLowerCase());
}
