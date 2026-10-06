import Link from 'next/link';
import { ArrowRight, CircleHelp, RotateCcw, Scale } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/utils';

const REFUND_STEPS = [
  {
    icon: CircleHelp,
    title: 'Start with the transaction',
    text: 'Include the invoice or payment reference, the company name, and the reason for the request. Never send full card details.',
  },
  {
    icon: Scale,
    title: 'We review the path',
    text: 'The responsible owner or platform operator reviews the configured refund policy, payment status, gateway rules, and any settlement hold.',
  },
  {
    icon: RotateCcw,
    title: 'The record is updated',
    text: 'Approved refunds are sent through the responsible payment path and the result is kept with the payment history.',
  },
];

export function RefundPageContent(): ReactNode {
  return (
    <>
      <section className="mx-auto max-w-content px-4 py-20 sm:px-6 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16 lg:px-8 lg:py-28">
        <div>
          <Badge variant="warning">Refund guidance</Badge>
          <h1 className="mt-6 font-heading text-5xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-7xl">
            A fair refund process needs a clear record.
          </h1>
        </div>
        <div className="rounded-[2rem] bg-brand-50 p-8 dark:bg-brand-950 sm:p-10">
          <p className="text-lg font-semibold leading-8 text-brand-950 dark:text-brand-50">
            A refund is reviewed against the transaction, the applicable policy, and the payment
            path that processed it.
          </p>
          <p className="mt-4 text-sm leading-7 text-brand-800 dark:text-brand-200">
            KD SOLUTION IT does not promise an outcome that belongs to a merchant, gateway, or
            platform settlement decision. We make the request and its status easier to understand.
          </p>
        </div>
      </section>
      <section className="border-y border-border bg-surface-muted">
        <div className="mx-auto max-w-content px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-5 md:grid-cols-3">
            {REFUND_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card key={step.title}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Icon
                        className="h-6 w-6 text-brand-700 dark:text-brand-300"
                        aria-hidden="true"
                      />
                      <span className="font-mono text-xs text-muted-foreground">
                        STEP 0{index + 1}
                      </span>
                    </div>
                    <CardTitle className="mt-6 text-xl">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-7 text-muted-foreground">{step.text}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <h2 className="font-heading text-4xl font-semibold tracking-[-0.05em]">
          Need to request a refund?
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Email the support team with the relevant reference, or sign in to use the account-specific
          support path.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a href="mailto:support@kdsolutionit.com" className={cn(buttonVariants({ size: 'lg' }))}>
            Email support <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <Link href="/login" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            Sign in
          </Link>
        </div>
      </section>
    </>
  );
}
