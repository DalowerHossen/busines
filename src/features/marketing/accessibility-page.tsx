import Link from 'next/link';
import { Accessibility, ArrowRight, Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/cn';
import { ACCESSIBILITY_PRACTICES } from './public-pages-data';

export function AccessibilityPageContent(): ReactNode {
  return (
    <>
      <section className="bg-brand-50 dark:bg-brand-950">
        <div className="mx-auto max-w-content px-4 py-20 sm:px-6 lg:grid lg:grid-cols-[1fr_0.8fr] lg:items-center lg:gap-16 lg:px-8 lg:py-28">
          <div>
            <Badge variant="brand">Accessibility</Badge>
            <h1 className="mt-6 max-w-3xl font-heading text-5xl font-semibold tracking-[-0.06em] sm:text-7xl">
              Useful software should make room for more people.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              We treat accessibility as a product quality requirement: clear structure, useful
              feedback, keyboard access, and responsive interaction across the devices people
              actually use.
            </p>
          </div>
          <div className="mt-10 flex justify-center lg:mt-0">
            <div className="flex h-44 w-44 items-center justify-center rounded-full border-[18px] border-brand-200 bg-card text-brand-700 shadow-xl dark:border-brand-800 dark:text-brand-300">
              <Accessibility className="h-20 w-20" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-content gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
            Our baseline
          </p>
          <h2 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.05em]">
            Accessibility is part of the interface contract.
          </h2>
        </div>
        <ul className="grid gap-4">
          {ACCESSIBILITY_PRACTICES.map((practice) => (
            <li
              key={practice}
              className="flex gap-4 rounded-xl border border-border p-5 text-sm leading-6"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success-foreground">
                <Check className="h-4 w-4" aria-hidden="true" />
              </span>
              {practice}
            </li>
          ))}
        </ul>
      </section>
      <section className="border-t border-border bg-surface-muted">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
          <h2 className="font-heading text-3xl font-semibold tracking-[-0.04em]">
            Something blocking your access?
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Tell us which page, device, assistive technology, or interaction is difficult and we
            will route the report to the product team.
          </p>
          <a
            href="mailto:support@kdsolutionit.com"
            className={cn(buttonVariants({ size: 'lg' }), 'mt-7')}
          >
            Report an accessibility issue <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <p className="mt-5 text-xs text-muted-foreground">
            You can also return to the{' '}
            <Link href="/" className="font-semibold text-brand-700 underline dark:text-brand-300">
              home page
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
