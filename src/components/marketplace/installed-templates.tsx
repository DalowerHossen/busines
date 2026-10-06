// src/components/marketplace/installed-templates.tsx
// What this business already runs, where it came from, and the two things
// that can be done about it: rate it or remove it.

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { rateTemplate } from '@/features/marketplace/actions/rate-template';
import { uninstallTemplate } from '@/features/marketplace/actions/uninstall-template';
import type { InstalledTemplate } from '@/features/marketplace/types';
import { formatDate } from '@/lib/dates';
import { humanise } from '@/lib/format';

export interface InstalledTemplatesProps {
  /** Templates live inside this business. */
  installs: readonly InstalledTemplate[];
  /** False when the viewer may look but not change anything. */
  canManage: boolean;
}

const RATING_OPTIONS = [
  { value: '', label: 'Rate it' },
  { value: '5', label: '5 - excellent' },
  { value: '4', label: '4 - good' },
  { value: '3', label: '3 - fair' },
  { value: '2', label: '2 - poor' },
  { value: '1', label: '1 - unusable' },
];

/**
 * Renders the installed templates.
 *
 * @param props The installs and whether they may be changed.
 * @returns The rendered table.
 */
export function InstalledTemplates({ installs, canManage }: InstalledTemplatesProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  if (installs.length === 0) {
    return (
      <EmptyState
        title="Nothing is installed yet"
        description="Browse the marketplace and install a template; it becomes part of this business immediately."
      />
    );
  }

  /**
   * Removes one installed template.
   *
   * @param installId Install being removed.
   * @returns Nothing.
   */
  async function onRemove(installId: string): Promise<void> {
    setBusyId(installId);
    setFailure(null);

    const result = await uninstallTemplate({ installId, reason: 'Removed by the owner' });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('The template has been removed.');
    router.refresh();
  }

  /**
   * Stores a rating for one installed template.
   *
   * @param listingId Listing being rated.
   * @param rating Score between one and five.
   * @returns Nothing.
   */
  async function onRate(listingId: string, rating: string): Promise<void> {
    if (rating.length === 0) {
      return;
    }

    setBusyId(listingId);
    setFailure(null);

    const result = await rateTemplate({ listingId, rating });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('Thank you. Your rating is on the listing.');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {failure === null ? null : (
        <Alert tone="danger" title="That did not work">
          {failure}
        </Alert>
      )}

      <Table caption="Templates installed in this business">
        <TableHeader>
          <TableRow>
            <TableHead>Template</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Installed</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installs.map((install) => (
            <TableRow key={install.installId}>
              <TableCell>
                <Link
                  href={`${ROUTES.marketplace}/${install.listingSlug}`}
                  className="font-medium text-brand-700 underline-offset-2 hover:underline"
                >
                  {install.title}
                </Link>
              </TableCell>
              <TableCell>{humanise(install.category)}</TableCell>
              <TableCell className="tabular">
                {install.installedVersion}
                {install.latestVersion !== install.installedVersion ? (
                  <Badge tone="info" className="ml-2">
                    {install.latestVersion} available
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell>{formatDate(install.installedAt)}</TableCell>
              <TableCell>
                {install.hasReview ? (
                  <Badge tone="success">Rated</Badge>
                ) : canManage ? (
                  <Select
                    aria-label={`Rate ${install.title}`}
                    options={RATING_OPTIONS}
                    defaultValue=""
                    disabled={busyId === install.listingId}
                    onChange={(event) => {
                      void onRate(install.listingId, event.target.value);
                    }}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">Not rated</span>
                )}
              </TableCell>
              <TableCell>
                {canManage ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={busyId === install.installId}
                    loadingLabel="Removing"
                    onClick={() => {
                      void onRemove(install.installId);
                    }}
                  >
                    Remove
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">Owner only</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
