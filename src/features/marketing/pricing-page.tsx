import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/cn';
import { PLAN_PREVIEWS } from './marketing-data';

export function PricingPageContent(): ReactNode {
  return (
    <>
      <section className="mx-auto max-w-content px-4 pb-16 pt-20 text-center sm:px-6 lg:px-8 lg:pt-28">
        <Badge variant="brand">Plans that grow with the work</Badge>
        <h1 className="mx-auto mt-6 max-w-3xl font-heading text-5xl font-semibold tracking-[-0.06em] sm:text-6xl">
          Start light. Add room when you need it.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          Choose a starting tier during onboarding. Live prices, limits, and entitlements are
          configurable by the platform team rather than hidden in frontend constants.
        </p>
      </section>
      <section className="mx-auto grid max-w-content gap-5 px-4 pb-20 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {PLAN_PREVIEWS.map((plan, index) => (
          <Card
            key={plan.name}
            className={cn('relative flex flex-col', index === 0 && 'border-brand-300 shadow-brand')}
          >
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                {index === 0 ? <Badge variant="success">Start here</Badge> : null}
              </div>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-brand-700 dark:text-brand-300">
                {plan.tone}
              </p>
              <p className="mt-4 min-h-12 text-sm leading-6 text-muted-foreground">
                {plan.description}
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ul className="space-y-3 text-sm">
                {plan.highlights.map((highlight) => (
                  <li key={highlight} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    {highlight}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ variant: index === 0 ? 'primary' : 'secondary', size: 'sm' }),
                  'mt-8 w-full'
                )}
              >
                {index === 0 ? 'Start free' : 'Choose this tier'}{' '}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="border-y border-border bg-surface-muted">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="font-heading text-3xl font-semibold tracking-[-0.04em]">
            Need a plan with a different shape?
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Your platform administrator can configure plan limits and entitlements. Contact the team
            when your operating model needs a closer fit.
          </p>
          <a
            href="mailto:support@kdsolutionit.com"
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-7')}
          >
            Talk to the team
          </a>
        </div>
      </section>
    </>
  );
}
