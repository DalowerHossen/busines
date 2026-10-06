// src/app/(auth)/reset-password/page.tsx
// Where a new password is chosen. The recovery session is established by
// Supabase from the link itself, so the form only needs the new password.

import type { Metadata } from 'next';

import { AuthCard } from '@/components/auth/auth-card';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { ROUTES } from '@/config/app';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Choose a new password',
  description: 'Set a new password for your workspace.',
  path: ROUTES.resetPassword,
  noIndex: true,
});

/**
 * Renders the new password page.
 *
 * @returns The rendered page.
 */
export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Choose a new password"
      description="Use a strong password to protect your billing workspace."
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
