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

export type BillingPeriod = 'monthly' | 'yearly';

export interface Plan {
  readonly key: string;
  readonly name: string;
  readonly tagline: string;
  readonly monthlyPrice: string;
  readonly yearlyPrice: string;
  readonly trialDays: number;
  readonly badge?: string;
  readonly callToAction: string;
  readonly highlights: readonly string[];
}

export const PLAN_CURRENCY = 'USD';

export const PLANS: readonly Plan[] = DEFAULT_PLAN_TIERS.filter(
  (plan) => plan.isPubliclyVisible
).map((plan) => ({
  key: plan.tierId,
  name: plan.name,
  tagline: `${plan.name} tools for growing businesses.`,
  monthlyPrice:
    plan.tierId === 'free'
      ? '0'
      : plan.tierId === 'starter'
        ? '19'
        : plan.tierId === 'professional'
          ? '49'
          : '99',
  yearlyPrice:
    plan.tierId === 'free'
      ? '0'
      : plan.tierId === 'starter'
        ? '15'
        : plan.tierId === 'professional'
          ? '39'
          : '79',
  trialDays: plan.tierId === 'free' ? 0 : 14,
  badge: plan.tierId === 'professional' ? 'Most popular' : undefined,
  callToAction: plan.tierId === 'free' ? 'Start free' : 'Start trial',
  highlights: ['Invoices and client records', 'Secure team access', 'Helpful business reports'],
}));

export const PLAN_COMPARISON = [
  {
    title: 'Core billing',
    rows: [
      {
        label: 'Invoices',
        values: { free: true, starter: true, professional: true, business: true },
      },
      {
        label: 'Client records',
        values: { free: true, starter: true, professional: true, business: true },
      },
      {
        label: 'Payment tracking',
        values: { free: true, starter: true, professional: true, business: true },
      },
    ],
  },
  {
    title: 'Business controls',
    rows: [
      {
        label: 'Team access',
        values: { free: false, starter: true, professional: true, business: true },
      },
      {
        label: 'Reports',
        values: { free: true, starter: true, professional: true, business: true },
      },
      {
        label: 'Exports',
        values: { free: false, starter: true, professional: true, business: true },
      },
    ],
  },
] as const;

export const PRICING_FAQ = [
  {
    question: 'Can I start without a card?',
    answer: 'Yes. The free plan does not require a card.',
  },
  {
    question: 'Can I change plans later?',
    answer: 'Yes. You can change your plan as your business grows.',
  },
] as const;
