import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  FileText,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/utils';
import { MARKETING_FEATURES } from './marketing-data';
import { SectionHeading } from '@/components/marketing/section-heading';

export function HomePageContent(): ReactNode {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,hsl(var(--brand-200)/0.55),transparent_34%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--brand-50)/0.7))] dark:bg-[radial-gradient(circle_at_80%_10%,hsl(var(--brand-800)/0.35),transparent_34%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--surface)))]"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-content gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-32">
          <div>
            <Badge variant="brand">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />A calmer way to bill
            </Badge>
            <h1 className="mt-6 max-w-3xl font-heading text-5xl font-semibold leading-[0.98] tracking-[-0.065em] text-foreground sm:text-6xl lg:text-7xl">
              Make billing feel like momentum.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              KD SOLUTION IT brings invoices, payments, clients, and the work around them into one
              clear operating rhythm.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={cn(buttonVariants({ size: 'lg' }), 'shadow-brand')}>
                Start free <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/features"
                className={buttonVariants({ variant: 'secondary', size: 'lg' })}
              >
                Explore the platform
              </Link>
            </div>
            <p className="mt-4 text-xs font-medium text-muted-foreground">
              Start with Free. Grow into the workflows your team needs.
            </p>
          </div>
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div
              className="absolute -inset-5 rounded-[2rem] bg-brand-500/10 blur-2xl"
              aria-hidden="true"
            />
            <div className="relative rounded-[1.5rem] border border-white/70 bg-white/80 p-4 shadow-lg backdrop-blur-xl dark:border-border dark:bg-card/80">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Workspace overview</p>
                  <p className="mt-1 font-heading text-lg font-semibold">Good morning, team</p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                  <BarChart3 className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 py-4">
                <div className="rounded-xl bg-brand-50 p-4 dark:bg-brand-950">
                  <p className="text-xs text-muted-foreground">Collected this month</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">$24,680</p>
                  <p className="mt-1 text-xs font-semibold text-success-foreground">
                    +12.8% from last month
                  </p>
                </div>
                <div className="rounded-xl bg-surface-muted p-4">
                  <p className="text-xs text-muted-foreground">Invoices due</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">18</p>
                  <p className="mt-1 text-xs font-semibold text-warning-foreground">
                    3 need attention
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Recent activity</p>
                  <span className="text-xs text-brand-700 dark:text-brand-300">View all</span>
                </div>
                <div className="mt-4 space-y-3">
                  <ActivityRow
                    icon={<CheckCircle2 />}
                    label="Invoice INV-1042 paid"
                    value="$1,240.00"
                    tone="success"
                  />
                  <ActivityRow
                    icon={<FileText />}
                    label="Estimate EST-208 sent"
                    value="Yesterday"
                    tone="brand"
                  />
                  <ActivityRow
                    icon={<UsersRound />}
                    label="New client added"
                    value="2 hours ago"
                    tone="neutral"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-content px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="One connected workspace"
          title="The details stay close to the decision."
          description="From the first client conversation to the final payout, each part of the workflow supports the next."
          isCentred
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {MARKETING_FEATURES.slice(0, 3).map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="border-border/80 shadow-sm">
                <CardHeader>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {feature.eyebrow}
                  </p>
                  <CardTitle className="mt-2 text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">{feature.description}</p>
                  <ul className="mt-5 space-y-2 text-sm text-foreground">
                    {feature.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2">
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
      </section>
      <section className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto grid max-w-content gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-300">
              Designed for the next action
            </p>
            <h2 className="mt-4 max-w-xl font-heading text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Less hunting. More doing.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-sidebar-muted">
              Role-aware access, evidence-ready records, and a thoughtful command center help your
              team move with confidence.
            </p>
            <Link
              href="/features"
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'lg' }),
                'mt-8 border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-active/20'
              )}
            >
              See how it works <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <DarkFeature
              icon={<FileText />}
              title="Invoices that remember"
              text="Snapshots keep the right company and client details attached to each document."
            />
            <DarkFeature
              icon={<UsersRound />}
              title="People see their lane"
              text="Teams get relevant navigation without giving up the wider picture."
            />
            <DarkFeature
              icon={<BarChart3 />}
              title="Numbers with context"
              text="Reports connect activity to the records that created it."
            />
            <DarkFeature
              icon={<Sparkles />}
              title="A better default"
              text="The product is designed around clarity, not a pile of disconnected screens."
            />
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-content px-4 py-20 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
          Ready when you are
        </p>
        <h2 className="mx-auto mt-3 max-w-2xl font-heading text-4xl font-semibold tracking-[-0.05em]">
          Give your business a cleaner billing rhythm.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
          Start with the Free plan, bring your existing workflow, and build from there.
        </p>
        <Link href="/signup" className={cn(buttonVariants({ size: 'lg' }), 'mt-8')}>
          Create your workspace <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}

function ActivityRow({
  icon,
  label,
  value,
  tone,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
  readonly tone: 'success' | 'brand' | 'neutral';
}): ReactNode {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg',
          tone === 'success' && 'bg-success-subtle text-success-foreground',
          tone === 'brand' && 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
          tone === 'neutral' && 'bg-surface-muted text-muted-foreground'
        )}
      >
        {icon && (
          <span className="[&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">
            {icon}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{label}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{value}</span>
    </div>
  );
}

function DarkFeature({
  icon,
  title,
  text,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly text: string;
}): ReactNode {
  return (
    <div className="rounded-xl border border-sidebar-border bg-white/[0.04] p-5">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300 [&>svg]:h-4 [&>svg]:w-4"
        aria-hidden="true"
      >
        {icon}
      </span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-sidebar-muted">{text}</p>
    </div>
  );
}
