// src/app/not-found.tsx
// Shown when an address does not match a page. It offers the ways out rather
// than leaving a person at a dead end.

import type { Metadata } from 'next';
import Link from 'next/link';

import { Logo } from '@/components/brand/logo';
import { buttonVariants } from '@/components/ui/button';
import { ROUTES } from '@/config/app';
import { BRAND } from '@/config/brand';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

/**
 * Renders the page shown for an unknown address.
 *
 * @returns The rendered page.
 */
export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-16 text-center"
    >
      <Logo />
      <p className="font-heading text-5xl font-semibold text-brand-700">404</p>
      <h1 className="text-2xl font-semibold text-foreground">We could not find that page</h1>
      <p className="max-w-prose text-muted-foreground">
        The link may be out of date, or the page may have moved. These are the places people usually
        want.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href={ROUTES.home} className={buttonVariants({ size: 'lg' })}>
          Go to the home page
        </Link>
        <Link
          href={ROUTES.dashboard}
          className={buttonVariants({ variant: 'outline', size: 'lg' })}
        >
          Open my dashboard
        </Link>
      </div>

      <p className="text-sm text-muted-foreground">
        Still stuck? Write to{' '}
        <a
          href={`mailto:${BRAND.supportEmail}`}
          className="font-medium text-primary hover:underline"
        >
          {BRAND.supportEmail}
        </a>
      </p>
    </main>
  );
}
