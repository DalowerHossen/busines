// src/components/dashboard/overview-metrics.tsx
// The row of figures at the top of the dashboard.

import { AlertTriangle, FileText, Users, Wallet } from 'lucide-react';

import { MetricCard } from '@/components/dashboard/metric-card';
import type { DashboardOverview } from '@/features/dashboard/queries/overview';
import { formatMoney, formatNumber } from '@/lib/format';

export interface OverviewMetricsProps {
  /** Figures read for the current business. */
  overview: DashboardOverview;
}

/**
 * Renders the figures at the top of the dashboard.
 *
 * @param props The figures to show.
 * @returns The rendered grid.
 */
export function OverviewMetrics({ overview }: OverviewMetricsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Outstanding"
        value={formatMoney(overview.outstandingTotal, overview.currency)}
        description="Issued and not yet paid, across every open invoice."
        icon={FileText}
      />

      <MetricCard
        label="Overdue"
        value={formatMoney(overview.overdueTotal, overview.currency)}
        description={
          overview.overdueCount === 1
            ? 'One invoice is past its due date.'
            : `${formatNumber(overview.overdueCount)} invoices are past their due date.`
        }
        icon={AlertTriangle}
        tone={overview.overdueCount > 0 ? 'warning' : 'neutral'}
      />

      <MetricCard
        label="Received this month"
        value={formatMoney(overview.paidThisMonthTotal, overview.currency)}
        description="Payments settled since the first of the month."
        icon={Wallet}
        tone="success"
      />

      <MetricCard
        label="Clients"
        value={formatNumber(overview.clientCount)}
        description={
          overview.draftCount === 1
            ? 'One invoice is still in draft.'
            : `${formatNumber(overview.draftCount)} invoices are still in draft.`
        }
        icon={Users}
      />
    </div>
  );
}
