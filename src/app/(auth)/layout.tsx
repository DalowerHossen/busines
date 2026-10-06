// src/app/(auth)/layout.tsx
// The frame around sign in, sign up and account recovery: the form on the
// left, what the product does on the right, and nothing else to distract.

import type { ReactNode } from 'react';

import { AuthAside } from '@/components/auth/auth-aside';

export interface AuthLayoutProps {
  /** The page being rendered. */
  children: ReactNode;
}

/**
 * Renders the authentication frame.
 *
 * @param props The page being rendered.
 * @returns The rendered layout.
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <main
        id="main-content"
        className="flex items-center justify-center bg-background px-4 py-12 sm:px-8"
      >
        {children}
      </main>

      <AuthAside />
    </div>
  );
}
