import Link from 'next/link';
import { ArrowLeft, FileCheck2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/utils';

const TERMS_SECTIONS = [
  [
    'Using the service',
    'KD SOLUTION IT provides a business billing and operations platform. You are responsible for the accuracy of the company, client, invoice, tax, and payment information entered by your authorized users.',
  ],
  [
    'Your workspace',
    'A workspace belongs to the company account that created it. Keep credentials private, assign permissions carefully, and tell us promptly if you suspect unauthorized access. You may not use the service to break the law, misrepresent a transaction, or upload harmful content.',
  ],
  [
    'Payments and third-party services',
    'Payment methods, gateways, storage, messaging, and other connections may be supplied by independent providers. Their documented terms and availability apply to those services. We do not ask the browser to hold provider secrets or raw card data.',
  ],
  [
    'Records and responsibility',
    'The platform can help organize records and evidence, but it is not legal, tax, accounting, or financial advice. Review documents, tax treatment, settlement decisions, and compliance obligations with the qualified adviser responsible for your business.',
  ],
  [
    'Changes and termination',
    'We may update the service, these terms, or a plan when needed. Material changes will be communicated through an appropriate product or email notice. You may stop using a workspace; retention, export, and deletion follow the configured policy and applicable obligations.',
  ],
];

export function TermsPageContent(): ReactNode {
  return (
    <main className="bg-sidebar text-sidebar-foreground">
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:py-28">
        <Badge variant="brand">Legal terms</Badge>
        <h1 className="mt-6 font-heading text-5xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-6xl">
          Terms that keep the relationship clear.
        </h1>
        <p className="mt-6 text-lg leading-8 text-sidebar-muted">
          These terms describe the baseline relationship between KD SOLUTION IT and the businesses
          using the platform.
        </p>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-300">
          Effective October 6, 2026 · Version 1.0
        </p>
      </section>
      <section className="bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
          {TERMS_SECTIONS.map(([title, text], index) => (
            <article key={title} className="border-b border-border py-8 first:pt-0">
              <div className="flex gap-5">
                <span className="font-mono text-sm text-brand-700 dark:text-brand-300">
                  0{index + 1}
                </span>
                <div>
                  <h2 className="font-heading text-2xl font-semibold tracking-[-0.03em]">
                    {title}
                  </h2>
                  <p className="mt-3 text-base leading-8 text-muted-foreground">{text}</p>
                </div>
              </div>
            </article>
          ))}
          <div className="mt-12 flex gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-6 dark:border-brand-800 dark:bg-brand-950">
            <FileCheck2
              className="h-6 w-6 shrink-0 text-brand-700 dark:text-brand-300"
              aria-hidden="true"
            />
            <p className="text-sm leading-6 text-brand-900 dark:text-brand-100">
              Questions about these terms? Contact{' '}
              <a className="font-bold underline" href="mailto:support@kdsolutionit.com">
                support@kdsolutionit.com
              </a>{' '}
              before relying on a workflow you do not understand.
            </p>
          </div>
          <Link href="/" className={cn(buttonVariants({ variant: 'quiet' }), 'mt-8')}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
