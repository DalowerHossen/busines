import Link from 'next/link';
import { ArrowRight, Compass, HeartHandshake } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/cn';
import { ABOUT_VALUES } from './public-pages-data';

export function AboutPageContent(): ReactNode {
  return (
    <>
      <section className="overflow-hidden bg-sidebar text-sidebar-foreground">
        <div className="mx-auto grid max-w-content gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end lg:px-8 lg:py-28">
          <div>
            <Badge variant="brand">About KD SOLUTION IT</Badge>
            <h1 className="mt-6 max-w-3xl font-heading text-5xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-7xl">
              Build a business that feels easier to run.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-sidebar-muted">
              We are building the operating layer around billing: the small decisions, records, and
              handoffs that help a business keep its promise to a client.
            </p>
          </div>
          <div className="relative rounded-[2rem] border border-sidebar-border bg-white/[0.05] p-7 sm:p-9">
            <Compass className="h-9 w-9 text-brand-300" aria-hidden="true" />
            <p className="mt-8 font-heading text-3xl font-semibold leading-tight">
              Good software does not hide the detail. It puts the detail in the right place.
            </p>
            <p className="mt-5 text-sm leading-6 text-sidebar-muted">
              That is the standard behind our product, our provider boundaries, and our approach to
              trust.
            </p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-content px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
              Why we exist
            </p>
            <h2 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.05em]">
              The work around the work matters.
            </h2>
          </div>
          <div className="space-y-5 text-base leading-8 text-muted-foreground">
            <p>
              Invoices, payments, client questions, team handoffs, and compliance evidence are
              rarely separate in real life. When the system separates them too aggressively, people
              spend their day rebuilding context.
            </p>
            <p>
              KD SOLUTION IT is designed for service teams, operators, and merchants who want a
              dependable center for that context. The product starts with billing, then makes the
              surrounding workflow easier to see.
            </p>
            <p>
              We keep the platform provider-neutral, server-owned, and tenant-aware so the business
              can grow without surrendering control of its records.
            </p>
          </div>
        </div>
      </section>
      <section className="border-y border-border bg-surface-muted">
        <div className="mx-auto max-w-content px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-5 md:grid-cols-3">
            {ABOUT_VALUES.map((value) => {
              const Icon = value.icon;
              return (
                <Card key={value.title}>
                  <CardHeader>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <CardTitle className="mt-5 text-xl">{value.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-muted-foreground">{value.text}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-content px-4 py-20 text-center sm:px-6 lg:px-8">
        <HeartHandshake
          className="mx-auto h-8 w-8 text-brand-600 dark:text-brand-300"
          aria-hidden="true"
        />
        <h2 className="mx-auto mt-5 max-w-2xl font-heading text-4xl font-semibold tracking-[-0.05em]">
          A thoughtful default for the next chapter.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
          See how the workspace brings the day-to-day details together, then start with the plan
          that fits today.
        </p>
        <Link href="/features" className={cn(buttonVariants({ size: 'lg' }), 'mt-8')}>
          Explore the platform <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
