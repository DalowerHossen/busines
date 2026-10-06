import Link from 'next/link';
import type { ReactNode } from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface AuthShellProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
}

export function AuthShell({
  eyebrow = 'Smart Billing for Modern Business',
  title,
  description,
  children,
  footer,
  className,
}: AuthShellProps): ReactNode {
  return (
    <main
      className={cn(
        'min-h-screen bg-background lg:grid lg:grid-cols-[minmax(20rem,0.85fr)_minmax(32rem,1.15fr)]',
        className
      )}
    >
      <aside className="relative hidden overflow-hidden bg-sidebar px-10 py-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div
          className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <Link
            href="/"
            className="inline-flex items-center gap-3 font-heading text-lg font-bold tracking-tight"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-brand">
              K
            </span>
            KD SOLUTION IT
          </Link>
          <p className="mt-20 max-w-md font-heading text-4xl font-semibold leading-tight tracking-[-0.04em]">
            Make every invoice feel like a confident next step.
          </p>
          <p className="mt-5 max-w-md text-base leading-7 text-sidebar-muted">
            One calm workspace for billing, payments, clients, and the operational rhythm behind a
            growing business.
          </p>
        </div>
        <div className="relative grid gap-3 text-sm text-sidebar-muted">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-active/20 text-brand-300">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>Clear workflows with less busywork.</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-active/20 text-brand-300">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>Tenant-aware controls and accountable access.</span>
          </div>
        </div>
      </aside>
      <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-form">
          <div className="mb-8 lg:hidden">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-heading text-base font-bold tracking-tight"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
                K
              </span>
              KD SOLUTION IT
            </Link>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600 dark:text-brand-300">
              {eyebrow}
            </p>
            <h1 className="mt-3 font-heading text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            <div className="mt-8">{children}</div>
          </div>
          {footer ? (
            <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
          ) : null}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            By continuing, you agree to the applicable terms and privacy policy.
          </p>
        </div>
      </section>
    </main>
  );
}
