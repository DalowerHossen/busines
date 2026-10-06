import Link from 'next/link';
import { ArrowRight, Lightbulb } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/cn';
import { GUIDE_STEPS } from './public-pages-data';

export function GuidesPageContent(): ReactNode {
  return (
    <>
      <section className="mx-auto max-w-content px-4 py-20 sm:px-6 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:px-8 lg:py-28">
        <div>
          <Badge variant="warning">Practical guide</Badge>
          <h1 className="mt-6 max-w-3xl font-heading text-5xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-7xl">
            Solve the billing bottleneck before you add another tool.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            A short operating guide for teams that want better visibility without turning every
            workflow into another project.
          </p>
        </div>
        <div className="mt-10 rounded-[2rem] border border-warning/30 bg-warning-subtle p-8 lg:mt-0">
          <Lightbulb className="h-8 w-8 text-warning-foreground" aria-hidden="true" />
          <p className="mt-7 font-heading text-2xl font-semibold leading-tight">
            Start with the moment your team loses context.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            That is usually where a clearer record creates more value than a new dashboard.
          </p>
        </div>
      </section>
      <section className="bg-surface-muted">
        <div className="mx-auto max-w-content px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-5 md:grid-cols-3">
            {GUIDE_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card key={step.label}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-brand-700 dark:text-brand-300">
                        0{index + 1}
                      </span>
                      <Icon
                        className="h-5 w-5 text-brand-700 dark:text-brand-300"
                        aria-hidden="true"
                      />
                    </div>
                    <CardTitle className="mt-7 text-xl">{step.label}</CardTitle>
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
          Make the next action easier to see.
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Explore the platform features or start with a workspace that keeps your billing context
          together.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/features"
            className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }))}
          >
            Explore features
          </Link>
          <Link href="/signup" className={cn(buttonVariants({ size: 'lg' }))}>
            Start your workspace <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
