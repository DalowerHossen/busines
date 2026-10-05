// src/config/plans.ts
// Default plan tier metadata used to seed the database (Phase 19) and as a
// fallback when the super_admin has not yet customised a tier's limits from
// the admin panel. Prices are intentionally NOT defined here: every plan's
// actual price is an owner/super_admin-editable row in the database, per
// the project's "DB value -> env var -> default" configuration model (see
// docs/planning/ARCHITECTURE-DECISIONS.md). `free` is always the plan
// assigned automatically on signup.
import type { PlanLimits, PlanTierId } from '@/types/subscription';

/**
 * Default usage limits for one plan tier, used only as seed data / a
 * fallback. The authoritative, live values always come from the `plans`
 * database table once it exists.
 */
export interface PlanTierDefault {
  readonly tierId: PlanTierId;
  readonly name: string;
  readonly limits: PlanLimits;
  readonly isPubliclyVisible: boolean;
  readonly sortOrder: number;
}

const UNLIMITED_PLAN_LIMITS: PlanLimits = {
  maxClients: null,
  maxInvoicesPerMonth: null,
  maxStaffSeats: null,
  maxStorageMb: null,
  maxWhatsAppMessagesPerMonth: null,
  allowsCustomBranding: true,
  allowsApiAccess: true,
  allowsMultiCurrency: true,
};

/**
 * The plan tier every company starts on, and the tier a company is
 * downgraded to when a paid subscription lapses. It never locks a company
 * out of its existing data, per the locked "never-lock downgrade" policy.
 */
export const DEFAULT_PLAN_TIER_ID: PlanTierId = 'free';

/**
 * Default tier definitions shipped as seed data. The super_admin can edit
 * every field below from the admin panel after the first deploy.
 */
export const DEFAULT_PLAN_TIERS: readonly PlanTierDefault[] = [
  {
    tierId: 'free',
    name: 'Free',
    isPubliclyVisible: true,
    sortOrder: 0,
    limits: {
      maxClients: 10,
      maxInvoicesPerMonth: 10,
      maxStaffSeats: 1,
      maxStorageMb: 200,
      maxWhatsAppMessagesPerMonth: 0,
      allowsCustomBranding: false,
      allowsApiAccess: false,
      allowsMultiCurrency: false,
    },
  },
  {
    tierId: 'starter',
    name: 'Starter',
    isPubliclyVisible: true,
    sortOrder: 1,
    limits: {
      maxClients: 100,
      maxInvoicesPerMonth: 100,
      maxStaffSeats: 3,
      maxStorageMb: 2048,
      maxWhatsAppMessagesPerMonth: 200,
      allowsCustomBranding: true,
      allowsApiAccess: false,
      allowsMultiCurrency: true,
    },
  },
  {
    tierId: 'professional',
    name: 'Professional',
    isPubliclyVisible: true,
    sortOrder: 2,
    limits: {
      maxClients: 1000,
      maxInvoicesPerMonth: 1000,
      maxStaffSeats: 10,
      maxStorageMb: 10240,
      maxWhatsAppMessagesPerMonth: 2000,
      allowsCustomBranding: true,
      allowsApiAccess: true,
      allowsMultiCurrency: true,
    },
  },
  {
    tierId: 'business',
    name: 'Business',
    isPubliclyVisible: true,
    sortOrder: 3,
    limits: {
      maxClients: null,
      maxInvoicesPerMonth: null,
      maxStaffSeats: 25,
      maxStorageMb: 51200,
      maxWhatsAppMessagesPerMonth: 10000,
      allowsCustomBranding: true,
      allowsApiAccess: true,
      allowsMultiCurrency: true,
    },
  },
  {
    tierId: 'enterprise',
    name: 'Enterprise',
    isPubliclyVisible: false,
    sortOrder: 4,
    limits: UNLIMITED_PLAN_LIMITS,
  },
];
