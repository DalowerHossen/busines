'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { IconButton } from '@/components/ui';

const PUBLIC_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/testimonials', label: 'Customer stories' },
  { href: '/faq', label: 'FAQ' },
  { href: '/merchant-onboarding', label: 'For merchants' },
] as const;

export function PublicMobileNav(): ReactNode {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <IconButton
        label={isOpen ? 'Close public navigation' : 'Open public navigation'}
        variant="quiet"
        aria-expanded={isOpen}
        aria-controls="public-mobile-navigation"
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Menu className="h-5 w-5" aria-hidden="true" />
        )}
      </IconButton>
      {isOpen ? (
        <nav
          id="public-mobile-navigation"
          aria-label="Mobile public navigation"
          className="absolute inset-x-0 top-16 border-b border-border bg-background px-4 py-4 shadow-lg sm:px-6"
        >
          <div className="mx-auto grid max-w-content gap-1">
            {PUBLIC_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-3 text-sm font-semibold text-foreground hover:bg-surface-muted"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
              <Link
                href="/login"
                className="rounded-md px-3 py-3 text-sm font-semibold text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                onClick={() => setIsOpen(false)}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-primary px-3 py-3 text-center text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
                onClick={() => setIsOpen(false)}
              >
                Get started
              </Link>
            </div>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
