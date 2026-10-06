// src/features/onboarding/types.ts
// The shapes the setup screens work with.

export interface OnboardingTask {
  key: string;
  title: string;
  description: string;
  href: string;
  isRequired: boolean;
  isDone: boolean;
  isDismissed: boolean;
}

export interface OnboardingState {
  status: string;
  kycStatus: string;
  requiredCount: number;
  requiredDone: number;
  isReadyToTrade: boolean;
  hasFirstPayment: boolean;
  tasks: readonly OnboardingTask[];
  /** True when the state could not be read. */
  isDegraded: boolean;
}
