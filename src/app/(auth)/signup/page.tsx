// src/app/(auth)/signup/page.tsx
// A long standing public link. Account creation lives at /register, so this
// address forwards there rather than keeping a second sign up form alive.

import { permanentRedirect } from 'next/navigation';

import { ROUTES } from '@/config/app';

/**
 * Forwards to the sign up page.
 *
 * @returns Never; the request is redirected.
 */
export default function SignupPage(): never {
  permanentRedirect(ROUTES.register);
}
