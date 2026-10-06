// src/components/admin/listing-review-queue.tsx
// The platform side of the marketplace: vendors asking to be let in, and
// listings asking to be put on sale. Both decisions are made here and
// nowhere else.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { moderateListing } from '@/features/admin/actions/moderate-listing';
import { reviewMarketplaceVendor } from '@/features/admin/actions/review-vendor';
import type { ListingQueueEntry, VendorProfile } from '@/features/marketplace/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface ListingReviewQueueProps {
  /** Listings waiting to be read. */
  listings: readonly ListingQueueEntry[];
  /** Vendors waiting to be let in. */
  vendors: readonly VendorProfile[];
}

/**
 * Renders the marketplace moderation console.
 *
 * @param props The listings and vendors waiting for a decision.
 * @returns The rendered console.
 */
export function ListingReviewQueue({ listings, vendors }: ListingReviewQueueProps) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const waiting = listings.filter((listing) => listing.status === 'in_review');
  const decided = listings.filter((listing) => listing.status !== 'in_review');

  /**
   * Publishes or refuses one listing.
   *
   * @param listingId Listing being decided.
   * @param decision What is being decided.
   * @returns Nothing.
   */
  async function onDecideListing(listingId: string, decision: 'publish' | 'reject'): Promise<void> {
    setBusyId(listingId);
    setFailure(null);

    const result = await moderateListing({
      listingId,
      decision,
      note: notes[listingId] ?? '',
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success(
      decision === 'publish' ? 'The listing is on sale.' : 'The vendor has been told why.'
    );
    router.refresh();
  }

  /**
   * Approves or closes one vendor application.
   *
   * @param vendorId Vendor being decided.
   * @param approve True to let the vendor in.
   * @returns Nothing.
   */
  async function onDecideVendor(vendorId: string, approve: boolean): Promise<void> {
    setBusyId(vendorId);
    setFailure(null);

    const share = shares[vendorId] ?? '';

    const result = await reviewMarketplaceVendor({
      vendorId,
      approve,
      note: notes[vendorId] ?? '',
      revenueSharePercentage: share.length > 0 ? share : null,
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success(approve ? 'The vendor can now publish.' : 'The application is closed.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {failure === null ? null : (
        <Alert tone="danger" title="That did not work">
          {failure}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Vendors</CardTitle>
          <CardDescription>
            A vendor sells inside other people&apos;s businesses, so read the application before
            approving it and set the share they keep.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vendors.length === 0 ? (
            <EmptyState
              title="No vendor has applied yet"
              description="Applications appear here as soon as a business offers to sell its templates."
            />
          ) : (
            <Table caption="Marketplace vendors">
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead isNumeric>Listings</TableHead>
                  <TableHead isNumeric>Installs</TableHead>
                  <TableHead>Share</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell>
                      <span className="font-medium text-foreground">{vendor.vendorName}</span>
                      <p className="text-xs text-muted-foreground">
                        {vendor.headline ?? vendor.supportEmail ?? vendor.vendorSlug}
                      </p>
                      <Badge tone={vendor.status === 'approved' ? 'success' : 'warning'}>
                        {humanise(vendor.status)}
                      </Badge>
                    </TableCell>
                    <TableCell isNumeric>{formatNumber(vendor.listingCount)}</TableCell>
                    <TableCell isNumeric>{formatNumber(vendor.installCount)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        aria-label={`Share for ${vendor.vendorName}`}
                        value={shares[vendor.id] ?? vendor.revenueSharePercentage}
                        onChange={(event) =>
                          setShares((current) => ({ ...current, [vendor.id]: event.target.value }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Note for ${vendor.vendorName}`}
                        value={notes[vendor.id] ?? ''}
                        onChange={(event) =>
                          setNotes((current) => ({ ...current, [vendor.id]: event.target.value }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          isLoading={busyId === vendor.id}
                          loadingLabel="Saving"
                          onClick={() => {
                            void onDecideVendor(vendor.id, true);
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void onDecideVendor(vendor.id, false);
                          }}
                        >
                          Close
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listings waiting to be read</CardTitle>
          <CardDescription>
            Publishing freezes the version buyers receive. Refusing one always needs a reason, and
            the vendor sees it on their desk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {waiting.length === 0 ? (
            <EmptyState
              title="Nothing is waiting"
              description="Listings appear here the moment a vendor sends one for review."
            />
          ) : (
            <Table caption="Listings in review">
              <TableHeader>
                <TableRow>
                  <TableHead>Listing</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead isNumeric>Price</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waiting.map((listing) => (
                  <TableRow key={listing.listingId}>
                    <TableCell>
                      <span className="font-medium text-foreground">{listing.title}</span>
                      <p className="text-xs text-muted-foreground">{listing.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {humanise(listing.category)}, version {listing.version}
                      </p>
                    </TableCell>
                    <TableCell>{listing.vendorName}</TableCell>
                    <TableCell isNumeric>
                      {listing.pricingModel === 'free'
                        ? 'Free'
                        : formatMoney(listing.priceAmount, listing.priceCurrency)}
                    </TableCell>
                    <TableCell>
                      {listing.submittedAt === null ? 'Just now' : formatDate(listing.submittedAt)}
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Note for ${listing.title}`}
                        value={notes[listing.listingId] ?? ''}
                        onChange={(event) =>
                          setNotes((current) => ({
                            ...current,
                            [listing.listingId]: event.target.value,
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          isLoading={busyId === listing.listingId}
                          loadingLabel="Saving"
                          onClick={() => {
                            void onDecideListing(listing.listingId, 'publish');
                          }}
                        >
                          Publish
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void onDecideListing(listing.listingId, 'reject');
                          }}
                        >
                          Refuse
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Already decided</CardTitle>
          <CardDescription>The last sixty listings and where they ended up.</CardDescription>
        </CardHeader>
        <CardContent>
          {decided.length === 0 ? (
            <EmptyState
              title="Nothing has been decided yet"
              description="Published and refused listings are listed here so the history stays visible."
            />
          ) : (
            <Table caption="Listings already decided">
              <TableHeader>
                <TableRow>
                  <TableHead>Listing</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decided.map((listing) => (
                  <TableRow key={listing.listingId}>
                    <TableCell>{listing.title}</TableCell>
                    <TableCell>{listing.vendorName}</TableCell>
                    <TableCell>
                      <Badge tone={listing.status === 'published' ? 'success' : 'danger'}>
                        {humanise(listing.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
