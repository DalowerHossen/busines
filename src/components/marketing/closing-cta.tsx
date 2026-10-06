// src/components/marketing/closing-cta.tsx
// The last thing on the page: one clear invitation, and a way to talk to a
// person instead.

import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { CLOSING_CTA } from '@/config/marketing';

/**
 * Renders the closing call to action.
 *
 * @returns The rendered section.
 */
export function ClosingCta() {
  return (
    <section className="bg-brand-700">
      <div className="mx-auto flex w-full max-w-content flex-col items-start gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {CLOSING_CTA.title}
          </h2>
          <p className="max-w-prose text-sm text-white/80 sm:text-base">
            {CLOSING_CTA.description}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={CLOSING_CTA.primaryCta.href}
            className={buttonVariants({
              size: 'lg',
              className: 'bg-white text-brand-700 hover:bg-white/90',
            })}
          >
            {CLOSING_CTA.primaryCta.label}
          </Link>
          <Link
            href={CLOSING_CTA.secondaryCta.href}
            className={buttonVariants({
              variant: 'outline',
              size: 'lg',
              className: 'border-white/40 bg-transparent text-white hover:bg-white/10',
            })}
          >
            {CLOSING_CTA.secondaryCta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
