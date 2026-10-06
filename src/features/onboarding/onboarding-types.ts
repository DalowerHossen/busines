import type { ActionResult } from '@/types/core';
import type { z } from 'zod';
import type { onboardingSchema } from '@/lib/validators';

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type OnboardingAction = (input: OnboardingInput) => Promise<ActionResult<unknown>>;

export interface OnboardingPlanOption {
  readonly tierId: OnboardingInput['planTierId'];
  readonly name: string;
  readonly summary: string;
  readonly isRecommended?: boolean;
}

export const DEFAULT_ONBOARDING_PLANS: readonly OnboardingPlanOption[] = [
  { tierId: 'free', name: 'Free', summary: 'Start with the essentials.', isRecommended: true },
  { tierId: 'starter', name: 'Starter', summary: 'For a small, growing operation.' },
  { tierId: 'professional', name: 'Professional', summary: 'For teams that need more room.' },
  { tierId: 'business', name: 'Business', summary: 'For established, multi-person teams.' },
];
