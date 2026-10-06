// src/components/auth/auth-card.tsx
// The panel every authentication page is built from, so sign in, sign up and
// password recovery all look like the same product.

import { type ReactNode } from 'react';

import { Logo } from '@/components/brand/logo';
import { ROUTES } from '@/config/app';

export interface AuthCardProps {
  /** Heading of the page. */
  title: string;
  /** Sentence under the heading. */
  description: string;
  /** The form itself. */
  children: ReactNode;
  /** Link offered under the form, such as the way to the other page. */
  footer?: ReactNode;
}

/**
 * Renders the card used by every authentication page.
 *
 * @param props Heading, description, form and footer.
 * @returns The rendered card.
 */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-md space-y-6">
      <Logo href={ROUTES.home} />

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">{children}</div>

      {footer ? <div className="text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
}
