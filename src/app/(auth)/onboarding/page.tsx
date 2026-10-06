// src/app/(auth)/onboarding/page.tsx
// A long standing link from the sign up emails. Setting a workspace up now
// happens inside the workspace itself, where the account and the company are
// already known, so this address forwards there.

import { permanentRedirect } from 'next/navigation';

import { ROUTES } from '@/config/app';

/**
 * Forwards to the setup checklist inside the workspace.
 *
 * @returns Never; the request is redirected.
 */
export default function OnboardingPage(): never {
  permanentRedirect(ROUTES.setup);
}
