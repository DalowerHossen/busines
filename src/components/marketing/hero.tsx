// src/components/marketing/hero.tsx
// The first screen of the website: what the product does, who it is for and
// the two things a visitor can do next.

import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { HERO } from '@/config/marketing';

const HIGHLIGHTS = [
  'Unlimited clients on every plan',
  'Online payments in nine ways',
  'Reminders that collect for you',
] as const;

/**
 * Renders the opening section of the home page.
 *
 * @returns The rendered hero.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-brand-50 to-background">
      <div className="mx-auto grid w-full max-w-content gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
        <div className="space-y-6">
          <p className="inline-flex items-center rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-medium text-brand-700">
            {HERO.eyebrow}
          </p>

          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {HERO.title}
          </h1>

          <p className="max-w-prose text-base text-muted-foreground sm:text-lg">{HERO.subtitle}</p>

          <ul className="space-y-2">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight} className="flex items-center gap-2 text-sm text-foreground">
                <Check aria-hidden="true" className="h-4 w-4 text-success" />
                {highlight}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={HERO.primaryCta.href} className={buttonVariants({ size: 'lg' })}>
              {HERO.primaryCta.label}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <Link
              href={HERO.secondaryCta.href}
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              {HERO.secondaryCta.label}
            </Link>
          </div>

          <p className="text-sm text-muted-foreground">{HERO.reassurance}</p>
        </div>

        <div className="relative">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoice</p>
                <p className="font-heading text-lg font-semibold text-foreground">INV-1042</p>
              </div>
              <span className="rounded-full bg-success-subtle px-3 py-1 text-xs font-medium text-success">
                Paid
              </span>
            </div>

            <dl className="space-y-2 py-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Riverside Dental Group</dt>
                <dd className="tabular text-foreground">2 items</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular text-foreground">$3,600.00</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax at 8.25%</dt>
                <dd className="tabular text-foreground">$297.00</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular">$3,897.00</dd>
              </div>
            </dl>

            <div className="rounded-md bg-surface-muted p-3 text-xs text-muted-foreground">
              Paid by card on 14 Jan 2026. Receipt sent to accounts@riverside.example.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
