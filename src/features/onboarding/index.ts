// src/features/onboarding/index.ts
// Public surface of the onboarding feature. The checklist component lives in
// components/onboarding; this barrel exposes the actions and the query the
// workspace setup page composes.

export { activateCompany } from './actions/activate-company';
export { dismissOnboardingTask } from './actions/dismiss-task';
export { loadOnboardingState } from './queries/get-onboarding';
