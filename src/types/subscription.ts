// src/types/subscription.ts
// Subscription plan domain types for a company's own subscription to KD
// SOLUTION IT (not to be confused with S4 "client subscription billing",
// where an owner bills their own clients on a recurring schedule - that
// lives in src/types/payment.ts / a future billing-lifecycle types file).
// The identifiers and limit shape are defined here; the actual price,
// currency, and limit numbers for each plan are owner-editable rows in the
// database (see docs/planning/ARCHITECTURE-DECISIONS.md "DB value -> env
// var -> default" resolution order) and seeded in Phase 19.
import type { Money, PlatformEntity, TenantScopedEntity, UUID } from '@/types/core';

/**
 * Every plan tier the platform ships out of the box. `free` is always the
 * default plan assigned on signup, per the project's acceptance criteria.
 * The super_admin can add further tiers from the admin panel without a
 * code change; this union only names the tiers that ship as seed data.
 */
export type PlanTierId = 'free' | 'starter' | 'professional' | 'business' | 'enterprise';

/**
 * Billing cadence for a paid plan.
 */
export type BillingCycle = 'monthly' | 'yearly';

/**
 * Usage ceilings enforced for a plan. `null` means unlimited. Reaching a
 * limit degrades gracefully (upgrade prompt), it never locks a company out
 * of its existing data, per the locked "never-lock downgrade" policy.
 */
export interface PlanLimits {
  readonly maxClients: number | null;
  readonly maxInvoicesPerMonth: number | null;
  readonly maxStaffSeats: number | null;
  readonly maxStorageMb: number | null;
  readonly maxWhatsAppMessagesPerMonth: number | null;
  readonly allowsCustomBranding: boolean;
  readonly allowsApiAccess: boolean;
  readonly allowsMultiCurrency: boolean;
}

/**
 * A subscription plan definition, editable by the super_admin.
 */
export interface Plan extends PlatformEntity {
  readonly tierId: PlanTierId;
  readonly name: string;
  readonly monthlyPrice: Money;
  readonly yearlyPrice: Money;
  readonly limits: PlanLimits;
  readonly isPubliclyVisible: boolean;
  readonly sortOrder: number;
}

/**
 * Lifecycle status of a company's subscription to a {@link Plan}.
 */
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'downgraded_to_free';

/**
 * A company's active subscription record.
 */
export interface Subscription extends TenantScopedEntity {
  readonly planId: UUID;
  readonly status: SubscriptionStatus;
  readonly billingCycle: BillingCycle;
  readonly trialEndsAt: string | null;
  readonly currentPeriodEndsAt: string | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly couponCode: string | null;
}
