import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/cn';
import { MARKETING_FEATURES } from './marketing-data';
import { SectionHeading } from './section-heading';

export function FeaturesPageContent(): ReactNode {
  return (
    <>
      <section className="mx-auto max-w-content px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pt-28">
        <Badge variant="brand">A connected operating system</Badge>
        <h1 className="mt-6 max-w-4xl font-heading text-5xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-6xl">
          Everything your billing rhythm needs to keep moving.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          Purposeful tools for the moments that matter: creating a document, collecting a payment,
          serving a client, and understanding what comes next.
        </p>
      </section>
      <section className="bg-surface-muted">
        <div className="mx-auto max-w-content px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-5 md:grid-cols-2">
            {MARKETING_FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.title}
                  className={cn(
                    'overflow-hidden',
                    index === 0 &&
                      'md:col-span-2 md:grid md:grid-cols-[0.85fr_1.15fr] md:items-center'
                  )}
                >
                  <CardHeader className="p-6 sm:p-8">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      {feature.eyebrow}
                    </p>
                    <CardTitle className="mt-3 text-2xl sm:text-3xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0 md:pt-0">
                    <p className="max-w-xl text-base leading-7 text-muted-foreground">
                      {feature.description}
                    </p>
                    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                      {feature.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-2 text-sm font-medium text-foreground">
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0 text-success"
                            aria-hidden="true"
                          />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-content px-4 py-20 text-center sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Ready for your workflow"
          title="Start with the part that is slowing you down."
          description="A focused first step is still a connected first step."
          align="center"
        />
        <Link href="/signup" className={cn(buttonVariants({ size: 'lg' }), 'mt-8')}>
          Start your workspace <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
