import Link from 'next/link';
import { ArrowRight, Braces, KeyRound, Webhook } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/utils';
import { API_RESOURCE_PREVIEWS } from './public-pages-data';

export function ApiDocsPageContent(): ReactNode {
  return (
    <>
      <section className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-content px-4 py-20 sm:px-6 lg:grid lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16 lg:px-8 lg:py-28">
          <div>
            <Badge variant="brand">Developer platform</Badge>
            <h1 className="mt-6 font-heading text-5xl font-semibold tracking-[-0.06em] sm:text-7xl">
              Connect the records, not a black box.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-sidebar-muted">
              The public API is designed around company-scoped records, explicit permissions, signed
              webhooks, and predictable operational context.
            </p>
          </div>
          <div className="mt-12 rounded-2xl border border-sidebar-border bg-black/20 p-5 font-mono text-xs leading-7 text-brand-200 sm:p-7 lg:mt-0">
            <p className="text-sidebar-muted">request boundary</p>
            <p>
              <span className="text-brand-300">Authorization:</span> Bearer api_key
            </p>
            <p>
              <span className="text-brand-300">X-Idempotency-Key:</span> unique-request-key
            </p>
            <p>
              <span className="text-brand-300">X-Company-Context:</span> authorized-company
            </p>
            <p className="mt-4 text-sidebar-muted">response boundary</p>
            <p>
              <span className="text-brand-300">request_id:</span> correlation-id
            </p>
            <p>
              <span className="text-brand-300">data:</span> tenant-scoped record
            </p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-content px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-2">
          {API_RESOURCE_PREVIEWS.map((resource) => {
            const Icon = resource.icon;
            return (
              <Card key={resource.name}>
                <CardHeader>
                  <Icon className="h-6 w-6 text-brand-700 dark:text-brand-300" aria-hidden="true" />
                  <CardTitle className="mt-5 text-xl">{resource.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-muted-foreground">{resource.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {resource.methods.map((method) => (
                      <span
                        key={method}
                        className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted-foreground"
                      >
                        {method}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
      <section className="border-y border-border bg-surface-muted">
        <div className="mx-auto grid max-w-content gap-5 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
          <div className="rounded-xl border border-border bg-card p-6">
            <KeyRound className="h-5 w-5 text-brand-700 dark:text-brand-300" aria-hidden="true" />
            <h2 className="mt-4 font-semibold">Scoped API keys</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Keys are generated and revoked by authorized workspace administrators, with permission
              scope kept explicit.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <Webhook className="h-5 w-5 text-brand-700 dark:text-brand-300" aria-hidden="true" />
            <h2 className="mt-4 font-semibold">Signed events</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Webhook delivery includes verification, retry, idempotency, and delivery history
              boundaries.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <Braces className="h-5 w-5 text-brand-700 dark:text-brand-300" aria-hidden="true" />
            <h2 className="mt-4 font-semibold">Stable contracts</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Versioned platform contracts stay separate from external provider request shapes and
              secrets.
            </p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <p className="text-sm leading-6 text-muted-foreground">
          The developer surface is released alongside the authenticated API and webhook routes. Ask
          about access and integration planning.
        </p>
        <Link href="/contact" className={cn(buttonVariants({ size: 'lg' }), 'mt-6')}>
          Talk to the team <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
