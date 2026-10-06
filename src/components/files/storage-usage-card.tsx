// src/components/files/storage-usage-card.tsx
// How much room the business has used, in a form a person can act on.

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { StorageSummary } from '@/features/files/types';
import { formatFileSize, formatNumber } from '@/lib/format';

export interface StorageUsageCardProps {
  /** The numbers as the database reported them. */
  summary: StorageSummary;
}

/**
 * Renders the storage usage card.
 *
 * @param props The numbers.
 * @returns The rendered card.
 */
export function StorageUsageCard({ summary }: StorageUsageCardProps) {
  const percentage = Math.min(Math.max(summary.usedPercentage, 0), 100);
  const isTight = percentage >= 80;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage</CardTitle>
        <CardDescription>
          {`${formatFileSize(summary.usedBytes)} of ${formatFileSize(
            summary.quotaBytes
          )} used across ${formatNumber(summary.fileCount)} files.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuenow={Math.round(percentage)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Storage used"
        >
          <div
            className={isTight ? 'h-full bg-warning' : 'h-full bg-brand-600'}
            style={{ width: `${String(percentage)}%` }}
          />
        </div>

        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted-foreground">Used</dt>
            <dd className="tabular text-lg font-semibold">{`${String(percentage)}%`}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Kept on cheaper storage</dt>
            <dd className="tabular text-lg font-semibold">{formatNumber(summary.archivedCount)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Attached to nothing</dt>
            <dd className="tabular text-lg font-semibold">{formatNumber(summary.orphanCount)}</dd>
          </div>
        </dl>

        {isTight ? (
          <p className="text-sm text-warning">
            You are close to your allowance. Remove what you no longer need, or move to a larger
            plan to keep uploading.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
