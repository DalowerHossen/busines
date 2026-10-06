// src/components/admin/tenant-summary-panel.tsx
// What one business is, who works inside it, how much it has been worth and
// how much of its plan it is using.

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { TenantDetail } from '@/features/admin/types';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface TenantSummaryPanelProps {
  /** Everything read about this tenant. */
  detail: TenantDetail;
}

/**
 * Renders the summary of one tenant.
 *
 * @param props The tenant detail.
 * @returns The rendered panels.
 */
export function TenantSummaryPanel({ detail }: TenantSummaryPanelProps) {
  const { tenant, totals, counts, owners, usage } = detail;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>{tenant.displayName}</CardTitle>
            <StatusBadge kind="company" status={tenant.status} />
            <StatusBadge kind="kyc" status={tenant.kycStatus} />
          </div>
          <CardDescription>
            {tenant.legalName} · {tenant.countryCode} · joined {formatDate(tenant.createdAt)}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Plan</dt>
              <dd className="font-medium text-foreground">{tenant.planName ?? 'No plan'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Pays</dt>
              <dd className="tabular font-medium text-foreground">
                {tenant.planAmount === null
                  ? '—'
                  : formatMoney(tenant.planAmount, tenant.baseCurrency)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Invoiced all time</dt>
              <dd className="tabular font-medium text-foreground">
                {formatMoney(totals.invoicedAllTime, tenant.baseCurrency)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Collected all time</dt>
              <dd className="tabular font-medium text-foreground">
                {formatMoney(totals.collectedAllTime, tenant.baseCurrency)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Fees we kept</dt>
              <dd className="tabular font-medium text-foreground">
                {formatMoney(totals.platformFeesAllTime, tenant.baseCurrency)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Clients on file</dt>
              <dd className="tabular font-medium text-foreground">
                {formatNumber(counts.clients)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>People and usage</CardTitle>
          <CardDescription>
            Who can sign in to this business, and how much of the plan is gone this period.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <ul className="space-y-2">
            {owners.map((owner) => (
              <li key={owner.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-foreground">
                  {owner.fullName.length > 0 ? owner.fullName : owner.email}
                </span>
                <span className="text-sm text-muted-foreground">
                  {owner.email} · last seen{' '}
                  {owner.lastSignInAt ? formatDateTime(owner.lastSignInAt) : 'never'}
                </span>
              </li>
            ))}
            {owners.length === 0 ? (
              <li className="text-sm text-muted-foreground">
                No account is attached to this business yet.
              </li>
            ) : null}
          </ul>

          <ul className="space-y-1.5 border-t border-border pt-4">
            {usage.map((line) => (
              <li
                key={line.metricKey}
                className="flex flex-wrap items-baseline justify-between gap-2"
              >
                <span className="text-sm text-foreground">{humanise(line.metricKey)}</span>
                <span className="tabular text-sm text-muted-foreground">
                  {line.allowance === null
                    ? `${formatNumber(line.used)} used, no limit`
                    : `${formatNumber(line.used)} of ${formatNumber(line.allowance)}`}
                </span>
              </li>
            ))}
            {usage.length === 0 ? (
              <li className="text-sm text-muted-foreground">Nothing has been metered yet.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
