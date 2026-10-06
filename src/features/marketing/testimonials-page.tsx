import Link from 'next/link';
import { ArrowRight, Quote } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Card, CardContent } from '@/components/ui';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CUSTOMER_STORIES } from './marketing-data';

export function TestimonialsPageContent(): ReactNode {
  return (
    <>
      <section className="mx-auto max-w-content px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pt-28">
        <Badge variant="brand">Customer stories</Badge>
        <h1 className="mt-6 max-w-4xl font-heading text-5xl font-semibold tracking-[-0.06em] sm:text-6xl">
          A billing workspace should make the work feel lighter.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          Different businesses, same desire: a reliable next step, clear records, and fewer places
          to lose the thread.
        </p>
      </section>
      <section className="bg-sidebar">
        <div className="mx-auto grid max-w-content gap-5 px-4 py-16 sm:px-6 lg:grid-cols-3 lg:px-8">
          {CUSTOMER_STORIES.map((story) => (
            <Card
              key={story.label}
              className="border-sidebar-border bg-white/[0.04] text-sidebar-foreground shadow-none"
            >
              <CardContent className="p-6 sm:p-8">
                <Quote className="h-7 w-7 text-brand-300" aria-hidden="true" />
                <blockquote className="mt-6 font-heading text-2xl font-medium leading-tight tracking-[-0.03em]">
                  “{story.quote}”
                </blockquote>
                <p className="mt-6 text-sm leading-6 text-sidebar-muted">{story.detail}</p>
                <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-brand-300">
                  {story.label}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section className="mx-auto grid max-w-content gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
            The common thread
          </p>
          <h2 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.05em]">
            Clarity compounds.
          </h2>
        </div>
        <div className="grid gap-4 text-sm leading-7 text-muted-foreground sm:grid-cols-2">
          <p className="rounded-xl border border-border bg-card p-5">
            When records stay connected, your team spends less time reconstructing what happened.
          </p>
          <p className="rounded-xl border border-border bg-card p-5">
            When access is role-aware, people can move quickly without seeing what they do not need.
          </p>
          <p className="rounded-xl border border-border bg-card p-5">
            When the defaults are thoughtful, a new workspace can feel familiar sooner.
          </p>
          <p className="rounded-xl border border-border bg-card p-5">
            When the rules are configurable, the product can grow with the business.
          </p>
        </div>
      </section>
      <section className="border-t border-border bg-surface-muted">
        <div className="mx-auto max-w-content px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="font-heading text-3xl font-semibold tracking-[-0.04em]">
            Build your own calmer rhythm.
          </h2>
          <Link href="/signup" className={cn(buttonVariants({ size: 'lg' }), 'mt-7')}>
            Start free <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
