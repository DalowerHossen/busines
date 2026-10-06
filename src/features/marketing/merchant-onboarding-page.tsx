import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/cn';
import { MERCHANT_STEPS } from './marketing-data';

export function MerchantOnboardingPageContent(): ReactNode {
  return (
    <>
      <section className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
        <div
          className="absolute -right-28 top-10 h-80 w-80 rounded-full bg-brand-500/25 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-content px-4 py-20 sm:px-6 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:px-8 lg:py-28">
          <div>
            <Badge variant="brand">For merchants</Badge>
            <h1 className="mt-6 max-w-3xl font-heading text-5xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-6xl">
              A clearer path from registration to go-live.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-sidebar-muted">
              Set up a business workspace, complete the right review, connect your checkout flow,
              and keep your payment records in one accountable place.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={cn(buttonVariants({ size: 'lg' }), 'shadow-brand')}>
                Register your business <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/faq" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                Read common questions
              </Link>
            </div>
          </div>
          <div className="mt-12 rounded-2xl border border-sidebar-border bg-white/[0.05] p-5 sm:p-7 lg:mt-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-300">
              The launch path
            </p>
            <div className="mt-6 space-y-4">
              {MERCHANT_STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.number} className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-brand-300">{step.number}</span>
                        <h2 className="font-semibold">{step.title}</h2>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-sidebar-muted">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-content px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Your own gateway path</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                Use your own configured gateway keys by default, with secure server-side credential
                handling and audit-ready payment records.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Platform settlement path</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                When eligible, the Merchant of Record path brings manual KYC, versioned terms,
                configurable fees, holds, and payout review into the workspace.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">One operational record</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                Orders, invoices, consent evidence, payment events, and customer communication can
                stay connected without exposing provider secrets.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
      <section className="bg-surface-muted">
        <div className="mx-auto grid max-w-content gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
              Go live with confidence
            </p>
            <h2 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.05em]">
              The system gets more useful as your operation gets more specific.
            </h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              'Manual review where it matters',
              'Provider-neutral integration boundary',
              'Versioned fees, terms, and tax rules',
              'Tenant-scoped access throughout',
            ].map((item) => (
              <li
                key={item}
                className="flex gap-3 rounded-xl border border-border bg-card p-5 text-sm font-medium"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="mx-auto max-w-content px-4 py-16 text-center sm:px-6 lg:px-8">
        <h2 className="font-heading text-3xl font-semibold tracking-[-0.04em]">
          Ready to begin the four-step path?
        </h2>
        <Link href="/signup" className={cn(buttonVariants({ size: 'lg' }), 'mt-7')}>
          Create a workspace <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
