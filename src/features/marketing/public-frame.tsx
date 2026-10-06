import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/utils';
import { PublicMobileNav } from './public-mobile-nav';

export function PublicSiteFrame({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-header border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 font-heading text-sm font-bold tracking-tight"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-brand">
              K
            </span>
            <span className="hidden sm:inline">KD SOLUTION IT</span>
          </Link>
          <nav
            className="hidden items-center gap-6 text-sm font-medium text-muted-foreground lg:flex"
            aria-label="Public navigation"
          >
            <Link href="/features" className="hover:text-foreground">
              Features
            </Link>
            <Link href="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link href="/testimonials" className="hover:text-foreground">
              Customer stories
            </Link>
            <Link href="/faq" className="hover:text-foreground">
              FAQ
            </Link>
            <Link href="/merchant-onboarding" className="hover:text-foreground">
              For merchants
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: 'sm' }), 'hidden sm:inline-flex')}
            >
              Get started <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <PublicMobileNav />
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-border bg-surface-muted">
        <div className="mx-auto grid max-w-content gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
          <div>
            <Link href="/" className="flex items-center gap-2 font-heading font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs text-primary-foreground">
                K
              </span>
              KD SOLUTION IT
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
              Smart Billing for Modern Business. Keep the detail, lose the noise.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Product</h2>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
              <Link href="/features" className="hover:text-foreground">
                Features
              </Link>
              <Link href="/pricing" className="hover:text-foreground">
                Pricing
              </Link>
              <Link href="/merchant-onboarding" className="hover:text-foreground">
                Merchant onboarding
              </Link>
              <Link href="/api-docs" className="hover:text-foreground">
                API docs
              </Link>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Learn</h2>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
              <Link href="/about" className="hover:text-foreground">
                About
              </Link>
              <Link href="/guides" className="hover:text-foreground">
                Guides
              </Link>
              <Link href="/blog" className="hover:text-foreground">
                Journal
              </Link>
              <Link href="/faq" className="hover:text-foreground">
                FAQ
              </Link>
              <Link href="/testimonials" className="hover:text-foreground">
                Customer stories
              </Link>
              <Link href="/status" className="hover:text-foreground">
                Status
              </Link>
              <Link href="/contact" className="hover:text-foreground">
                Contact
              </Link>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Support</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Questions about your workspace?
            </p>
            <a
              href="mailto:support@kdsolutionit.com"
              className="mt-2 inline-flex text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              support@kdsolutionit.com
            </a>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-content flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <span>© 2026 KD SOLUTION IT. All rights reserved.</span>
            <div className="flex gap-4">
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
              <Link href="/refund" className="hover:text-foreground">
                Refunds
              </Link>
              <Link href="/security" className="hover:text-foreground">
                Security
              </Link>
              <Link href="/dpa" className="hover:text-foreground">
                DPA
              </Link>
              <Link href="/accessibility" className="hover:text-foreground">
                Accessibility
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
