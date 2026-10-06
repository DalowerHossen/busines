'use client';

import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronRight,
  FilePlus2,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { cn } from '@/lib/cn';
import { DASHBOARD_DATA, type DashboardData, type DashboardTask } from './dashboard-data';

export function DashboardPage({
  data = DASHBOARD_DATA,
}: {
  readonly data?: DashboardData;
}): ReactNode {
  return (
    <div className="space-y-6 pb-8">
      <DashboardHeader data={data} />
      <section aria-label="Workspace summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.85fr)]">
        <RevenueCard data={data} />
        <CashPositionCard />
      </section>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.85fr)]">
        <RecentInvoicesCard data={data} />
        <ActionCenter tasks={data.tasks} />
      </section>
    </div>
  );
}

function DashboardHeader({ data }: { readonly data: DashboardData }): ReactNode {
  return (
    <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>{data.companyName}</span>
        </div>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-4xl">
          Good morning, {data.firstName}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Here is the pulse of your workspace. Keep the important work moving without losing the
          details behind it.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
          onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
        >
          Search workspace
        </Button>
        <Link
          href="/invoices/new"
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New invoice
        </Link>
      </div>
    </header>
  );
}

function StatCard({
  label,
  value,
  change,
  changeDirection,
  description,
}: DashboardData['stats'][number]): ReactNode {
  const isPositive = changeDirection === 'up';
  const isNeutral = changeDirection === 'neutral';
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              isNeutral
                ? 'bg-surface-muted text-muted-foreground'
                : isPositive
                  ? 'bg-success-subtle text-success-foreground'
                  : 'bg-warning-subtle text-warning-foreground'
            )}
          >
            {isNeutral ? (
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
            ) : isPositive ? (
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
        </div>
        <p className="mt-4 font-heading text-2xl font-semibold tracking-[-0.035em]">{value}</p>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span
            className={cn(
              'font-semibold',
              isNeutral
                ? 'text-muted-foreground'
                : isPositive
                  ? 'text-success-foreground'
                  : 'text-warning-foreground'
            )}
          >
            {change}
          </span>
          <span className="text-muted-foreground">{description}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function RevenueCard({ data }: { readonly data: DashboardData }): ReactNode {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Revenue collected</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            The last six months in {data.currencyCode}
          </p>
        </div>
        <Button variant="secondary" size="sm">
          Last 6 months
          <ChevronRight className="h-3.5 w-3.5 rotate-90" aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-3" aria-label="Revenue chart">
          <div>
            <p className="font-heading text-3xl font-semibold tracking-[-0.04em]">$117.5k</p>
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-success-foreground">
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> 9.4% vs previous period
            </p>
          </div>
          <span className="rounded-full bg-success-subtle px-2.5 py-1 text-xs font-semibold text-success-foreground">
            On track
          </span>
        </div>
        <div className="mt-7 grid h-48 grid-cols-6 items-end gap-3 border-b border-l border-border px-3 pb-0 pt-4 sm:gap-5">
          {data.revenue.map((point) => (
            <div key={point.label} className="flex h-full flex-col items-center justify-end gap-2">
              <span className="hidden text-[10px] font-semibold text-muted-foreground sm:block">
                {point.displayAmount}
              </span>
              <div
                className="w-full max-w-10 rounded-t-md bg-brand-500 transition-[height] duration-slow hover:bg-brand-600"
                style={{ height: `${point.amount}%` }}
                title={`${point.label}: ${point.displayAmount}`}
                role="img"
                aria-label={`${point.label}: ${point.displayAmount}`}
              />
              <span className="text-[11px] font-medium text-muted-foreground">{point.label}</span>
            </div>
          ))}
        </div>
        <p className="sr-only">
          Revenue increased from $16.4k in May to $24.7k in October, with the highest collection in
          the current month.
        </p>
      </CardContent>
    </Card>
  );
}

function CashPositionCard(): ReactNode {
  return (
    <Card className="bg-sidebar text-sidebar-foreground">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-sidebar-muted">Cash position</p>
            <CardTitle className="mt-1 text-sidebar-foreground">$32,940.00</CardTitle>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
            <WalletCards className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-xs">
          <span className="text-sidebar-muted">Available balance</span>
          <span className="font-semibold text-sidebar-foreground">78%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[78%] rounded-full bg-brand-400" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-sidebar-border bg-white/[0.04] p-3">
            <p className="text-xs text-sidebar-muted">Expected this week</p>
            <p className="mt-1 font-semibold">$4,820</p>
          </div>
          <div className="rounded-lg border border-sidebar-border bg-white/[0.04] p-3">
            <p className="text-xs text-sidebar-muted">Payouts pending</p>
            <p className="mt-1 font-semibold">$1,240</p>
          </div>
        </div>
        <Link
          href="/payments"
          className="mt-6 flex items-center justify-between rounded-md border border-sidebar-border px-3 py-2.5 text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-white/[0.06]"
        >
          View payment activity
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}

function RecentInvoicesCard({ data }: { readonly data: DashboardData }): ReactNode {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Recent invoices</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            The latest movement across your workspace
          </p>
        </div>
        <Link
          href="/invoices"
          className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300"
        >
          View all <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-y border-border bg-surface-muted/60 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-6 py-3 font-semibold">
                  Invoice
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Due date
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Amount
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.recentInvoices.map((invoice) => (
                <tr key={invoice.id} className="group transition-colors hover:bg-surface-muted/50">
                  <td className="px-6 py-4">
                    <Link href={`/invoices?search=${invoice.number}`} className="block min-w-40">
                      <span className="font-semibold text-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300">
                        {invoice.number}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {invoice.client}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{invoice.dueAt}</td>
                  <td className="px-4 py-4 font-semibold text-foreground">{invoice.amount}</td>
                  <td className="px-4 py-4">
                    <InvoiceStatus status={invoice.status} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/invoices?search=${invoice.number}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-surface-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                      aria-label={`Open ${invoice.number}`}
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function InvoiceStatus({
  status,
}: {
  readonly status: DashboardData['recentInvoices'][number]['status'];
}): ReactNode {
  const labels = { paid: 'Paid', pending: 'Pending', overdue: 'Overdue', draft: 'Draft' };
  const variants = {
    paid: 'success',
    pending: 'info',
    overdue: 'warning',
    draft: 'neutral',
  } as const;
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

function ActionCenter({ tasks }: { readonly tasks: readonly DashboardTask[] }): ReactNode {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Action center</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Small steps that keep the workspace healthy
            </p>
          </div>
          <Bell className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        <Link
          href="/notifications"
          className="flex items-center justify-center gap-2 rounded-md border border-border py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted"
        >
          Open notification center <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}

function TaskCard({ task }: { readonly task: DashboardTask }): ReactNode {
  const Icon = { FilePlus2, Users, ShieldCheck }[task.iconName];
  return (
    <Link
      href={task.href}
      className="group flex gap-3 rounded-lg border border-border p-3 transition-colors hover:border-brand-300 hover:bg-surface-muted/60"
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          task.tone === 'brand' &&
            'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
          task.tone === 'success' && 'bg-success-subtle text-success-foreground',
          task.tone === 'warning' && 'bg-warning-subtle text-warning-foreground'
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300">
          {task.title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {task.description}
        </span>
      </span>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
