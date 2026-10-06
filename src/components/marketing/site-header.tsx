// src/components/marketing/site-header.tsx
// The bar at the top of the public website. On a phone the links collapse
// into a panel that can be opened and closed from the keyboard.

'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Logo } from '@/components/brand/logo';
import { Button, buttonVariants } from '@/components/ui/button';
import { ROUTES } from '@/config/app';
import { MARKETING_NAV } from '@/config/marketing';
import { cn } from '@/lib/utils';

/**
 * Renders the public navigation bar.
 *
 * @returns The rendered header.
 */
export function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-header border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-topbar w-full max-w-content items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {MARKETING_NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname === link.href
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link href={ROUTES.login} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Sign in
          </Link>
          <Link href={ROUTES.register} className={buttonVariants({ size: 'sm' })}>
            Start free
          </Link>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation"
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => {
            setIsMenuOpen((open) => !open);
          }}
        >
          {isMenuOpen ? (
            <X aria-hidden="true" className="h-5 w-5" />
          ) : (
            <Menu aria-hidden="true" className="h-5 w-5" />
          )}
        </Button>
      </div>

      {isMenuOpen ? (
        <div id="mobile-navigation" className="border-t border-border bg-background md:hidden">
          <nav aria-label="Main" className="mx-auto flex max-w-content flex-col gap-1 px-4 py-3">
            {MARKETING_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex min-h-touch items-center rounded-md px-3 text-sm font-medium text-foreground hover:bg-surface-muted"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={ROUTES.login}
              className="flex min-h-touch items-center rounded-md px-3 text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              Sign in
            </Link>
            <Link
              href={ROUTES.register}
              className="mt-1 flex min-h-touch items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              Start free
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
