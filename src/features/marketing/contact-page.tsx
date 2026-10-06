import Link from 'next/link';
import { ArrowUpRight, Clock3, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CONTACT_PATHS } from './public-pages-data';

export function ContactPageContent(): ReactNode {
  return (
    <>
      <section className="mx-auto max-w-content px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pt-28">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.7fr] lg:items-end">
          <div>
            <Badge variant="brand">Contact</Badge>
            <h1 className="mt-6 max-w-3xl font-heading text-5xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-7xl">
              A clear route to the right conversation.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Tell us what you are trying to make easier. We will help you find the right product,
              support, or partnership path.
            </p>
          </div>
          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 dark:border-brand-800 dark:bg-brand-950">
            <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">
              The quickest path
            </p>
            <p className="mt-2 text-sm leading-6 text-brand-800 dark:text-brand-200">
              For general questions, email support directly. For account-specific help, sign in so
              the support team can work within the right company context.
            </p>
          </div>
        </div>
      </section>
      <section className="bg-surface-muted">
        <div className="mx-auto max-w-content px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-5 md:grid-cols-3">
            {CONTACT_PATHS.map((path) => {
              const Icon = path.icon;
              const isInternal = path.href.startsWith('/');
              return (
                <Card key={path.title} className="flex flex-col">
                  <CardHeader>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-card text-brand-700 shadow-sm dark:text-brand-300">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <CardTitle className="mt-5 text-xl">{path.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col">
                    <p className="text-sm leading-6 text-muted-foreground">{path.detail}</p>
                    {isInternal ? (
                      <Link
                        href={path.href}
                        className={cn(
                          buttonVariants({ variant: 'secondary', size: 'sm' }),
                          'mt-6 self-start'
                        )}
                      >
                        {path.action}
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    ) : (
                      <a
                        href={path.href}
                        className="mt-6 inline-flex self-start text-sm font-bold text-brand-700 hover:underline dark:text-brand-300"
                      >
                        {path.action}
                      </a>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-content gap-8 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
            Support with context
          </p>
          <h2 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.05em]">
            The right details make a faster answer.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            When you contact us, include the workspace or company name, the workflow you were using,
            and the outcome you expected. Never send passwords, card numbers, or provider secrets by
            email.
          </p>
        </div>
        <div className="grid gap-4">
          <div className="flex gap-4 rounded-xl border border-border p-5">
            <Clock3
              className="h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold">Response expectations</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Support requests are reviewed during business hours, with urgent security reports
                routed separately.
              </p>
            </div>
          </div>
          <div className="flex gap-4 rounded-xl border border-border p-5">
            <MapPin
              className="h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold">Asia-first, globally ready</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Our public support channel is available for businesses operating across Asia and
                beyond.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
