import Link from 'next/link';
import { ArrowUpRight, Bug, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/utils';
import { SECURITY_PRINCIPLES } from './public-pages-data';

export function SecurityPageContent(): ReactNode {
  return (
    <>
      <section className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-content px-4 py-20 sm:px-6 lg:flex lg:items-end lg:justify-between lg:gap-12 lg:px-8 lg:py-28">
          <div>
            <Badge variant="brand">Security at KD SOLUTION IT</Badge>
            <h1 className="mt-6 max-w-3xl font-heading text-5xl font-semibold tracking-[-0.06em] sm:text-7xl">
              Trust is a system, not a badge.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-sidebar-muted">
              We design security boundaries around the records that matter: identity, tenant
              context, secrets, payments, files, and evidence.
            </p>
          </div>
          <div className="mt-10 flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-brand-400/30 bg-brand-500/15 text-brand-300 lg:mt-0">
            <ShieldCheck className="h-11 w-11" aria-hidden="true" />
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-content px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {SECURITY_PRINCIPLES.map((principle) => {
            const Icon = principle.icon;
            return (
              <Card key={principle.title}>
                <CardHeader>
                  <Icon className="h-6 w-6 text-brand-700 dark:text-brand-300" aria-hidden="true" />
                  <CardTitle className="mt-5 text-xl">{principle.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-muted-foreground">{principle.text}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
      <section className="border-y border-border bg-surface-muted">
        <div className="mx-auto grid max-w-content gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
              Responsible disclosure
            </p>
            <h2 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.05em]">
              Found a security issue?
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Please share enough detail to reproduce the issue without sending live secrets or
              private customer data.
            </p>
            <a
              href="mailto:security@kdsolutionit.com"
              className={cn(buttonVariants({ size: 'sm' }), 'mt-6')}
            >
              Email security <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
          <div className="rounded-2xl border border-border bg-card p-7">
            <div className="flex gap-4">
              <Bug
                className="h-6 w-6 shrink-0 text-brand-700 dark:text-brand-300"
                aria-hidden="true"
              />
              <div>
                <h3 className="font-semibold">Include the useful signal</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                  <li>• Affected URL, feature, or workflow</li>
                  <li>• Reproduction steps and expected versus actual behavior</li>
                  <li>• Impact assessment and a safe proof of concept</li>
                  <li>• Your preferred contact and disclosure timeline</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-content px-4 py-16 text-center sm:px-6 lg:px-8">
        <LockKeyhole
          className="mx-auto h-7 w-7 text-brand-600 dark:text-brand-300"
          aria-hidden="true"
        />
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
          Security controls are continuously expanded as the platform moves from contracts and
          schema to authenticated production workflows. See the{' '}
          <Link href="/faq" className="font-semibold text-brand-700 underline dark:text-brand-300">
            FAQ
          </Link>{' '}
          for practical account and payment boundaries.
        </p>
      </section>
    </>
  );
}
