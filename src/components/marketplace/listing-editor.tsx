// src/components/marketplace/listing-editor.tsx
// The vendor desk: the listings already written, and the form that writes
// the next one. A listing is saved as a draft, sent for review, and only
// then does the platform put it on sale.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { saveListing } from '@/features/marketplace/actions/save-listing';
import { submitListingForReview } from '@/features/marketplace/actions/submit-listing';
import { unpublishListing } from '@/features/marketplace/actions/unpublish-listing';
import type { VendorListing } from '@/features/marketplace/types';
import {
  LISTING_ARTIFACT_KINDS,
  LISTING_CATEGORIES,
} from '@/features/marketplace/validation/marketplace';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface ListingEditorProps {
  /** Listings this vendor has written. */
  listings: readonly VendorListing[];
  /** Currency the vendor is paid in. */
  currency: string;
  /** False while the vendor account is still being reviewed. */
  isApproved: boolean;
}

/**
 * Picks the badge tone that matches the state of a listing.
 *
 * @param status State of the listing.
 * @returns The tone to render.
 */
function toneForStatus(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'published') {
    return 'success';
  }

  if (status === 'in_review') {
    return 'warning';
  }

  if (status === 'rejected') {
    return 'danger';
  }

  return 'neutral';
}

/**
 * Renders the vendor desk.
 *
 * @param props The listings and the state of the vendor account.
 * @returns The rendered card.
 */
export function ListingEditor({ listings, currency, isApproved }: ListingEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [listingSlug, setListingSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(LISTING_CATEGORIES[0]);
  const [artifactKind, setArtifactKind] = useState<string>(LISTING_ARTIFACT_KINDS[0]);
  const [artifactPayload, setArtifactPayload] = useState('{\n  "sections": []\n}');
  const [pricingModel, setPricingModel] = useState('free');
  const [priceAmount, setPriceAmount] = useState('0');
  const [version, setVersion] = useState('1.0.0');
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Writes a new draft listing.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);

    const result = await saveListing({
      listingId: null,
      listingSlug,
      title,
      summary,
      description,
      category,
      artifactKind,
      artifactPayload,
      pricingModel,
      priceAmount: pricingModel === 'free' ? '0' : priceAmount,
      priceCurrency: currency,
      version,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('The listing is saved as a draft.');
    setTitle('');
    setListingSlug('');
    setSummary('');
    setDescription('');
    router.refresh();
  }

  /**
   * Sends one listing to review.
   *
   * @param listingId Listing being sent.
   * @returns Nothing.
   */
  async function onSubmitForReview(listingId: string): Promise<void> {
    setBusyId(listingId);
    setFailure(null);

    const result = await submitListingForReview({ listingId });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('The listing is with the platform team.');
    router.refresh();
  }

  /**
   * Takes one listing off sale.
   *
   * @param listingId Listing being withdrawn.
   * @returns Nothing.
   */
  async function onUnpublish(listingId: string): Promise<void> {
    setBusyId(listingId);
    setFailure(null);

    const result = await unpublishListing({ listingId, reason: 'Withdrawn by the vendor' });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('The listing is no longer on sale.');
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
          <CardTitle>Your listings</CardTitle>
          <CardDescription>
            A listing is read by the platform team before it goes on sale, and you can take it off
            sale again whenever you like.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listings.length === 0 ? (
            <EmptyState
              title="You have not written a listing yet"
              description="Package something you already use in your own business and offer it below."
            />
          ) : (
            <Table caption="Listings you have written">
              <TableHeader>
                <TableRow>
                  <TableHead>Listing</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead isNumeric>Price</TableHead>
                  <TableHead isNumeric>Installs</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listings.map((listing) => (
                  <TableRow key={listing.listingId}>
                    <TableCell>
                      <span className="font-medium text-foreground">{listing.title}</span>
                      <p className="text-xs text-muted-foreground">
                        Version {listing.version}
                        {listing.publishedAt === null
                          ? ''
                          : ` published ${formatDate(listing.publishedAt)}`}
                      </p>
                      {listing.status === 'rejected' && listing.reviewNotes !== null ? (
                        <p className="text-xs text-destructive">{listing.reviewNotes}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>{humanise(listing.category)}</TableCell>
                    <TableCell isNumeric>
                      {listing.pricingModel === 'free'
                        ? 'Free'
                        : formatMoney(listing.priceAmount, listing.priceCurrency)}
                    </TableCell>
                    <TableCell isNumeric>{formatNumber(listing.installCount)}</TableCell>
                    <TableCell>
                      <Badge tone={toneForStatus(listing.status)}>{humanise(listing.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      {listing.status === 'published' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          isLoading={busyId === listing.listingId}
                          loadingLabel="Withdrawing"
                          onClick={() => {
                            void onUnpublish(listing.listingId);
                          }}
                        >
                          Take off sale
                        </Button>
                      ) : listing.status === 'in_review' ? (
                        <span className="text-sm text-muted-foreground">Being read</span>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          isLoading={busyId === listing.listingId}
                          loadingLabel="Sending"
                          onClick={() => {
                            void onSubmitForReview(listing.listingId);
                          }}
                        >
                          Send for review
                        </Button>
                      )}
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
          <CardTitle>Write a listing</CardTitle>
          <CardDescription>
            The content is the packaged template itself, written as JSON. It is frozen at the
            version you publish, so buyers always get what was reviewed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isApproved ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="listing-title" label="Title" isRequired>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                    {...fieldAccessibilityProps('listing-title', false, false)}
                  />
                </FormField>

                <FormField
                  id="listing-slug"
                  label="Address"
                  hint="Lower case letters, numbers and hyphens."
                  isRequired
                >
                  <Input
                    value={listingSlug}
                    onChange={(event) => setListingSlug(event.target.value)}
                    required
                    {...fieldAccessibilityProps('listing-slug', true, false)}
                  />
                </FormField>
              </div>

              <FormField
                id="listing-summary"
                label="Summary"
                hint="Between twenty and two hundred characters."
                isRequired
              >
                <Input
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  required
                  {...fieldAccessibilityProps('listing-summary', true, false)}
                />
              </FormField>

              <FormField id="listing-description" label="Full description">
                <Textarea
                  value={description}
                  rows={4}
                  onChange={(event) => setDescription(event.target.value)}
                  {...fieldAccessibilityProps('listing-description', false, false)}
                />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="listing-category" label="Kind of template" isRequired>
                  <Select
                    value={category}
                    options={LISTING_CATEGORIES.map((value) => ({
                      value,
                      label: humanise(value),
                    }))}
                    onChange={(event) => setCategory(event.target.value)}
                    {...fieldAccessibilityProps('listing-category', false, false)}
                  />
                </FormField>

                <FormField id="listing-artifact" label="What the buyer receives" isRequired>
                  <Select
                    value={artifactKind}
                    options={LISTING_ARTIFACT_KINDS.map((value) => ({
                      value,
                      label: humanise(value),
                    }))}
                    onChange={(event) => setArtifactKind(event.target.value)}
                    {...fieldAccessibilityProps('listing-artifact', false, false)}
                  />
                </FormField>
              </div>

              <FormField
                id="listing-payload"
                label="Template content"
                hint="A JSON object describing what the template installs."
                isRequired
              >
                <Textarea
                  value={artifactPayload}
                  rows={6}
                  onChange={(event) => setArtifactPayload(event.target.value)}
                  required
                  {...fieldAccessibilityProps('listing-payload', true, false)}
                />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField id="listing-pricing" label="Price model" isRequired>
                  <Select
                    value={pricingModel}
                    options={[
                      { value: 'free', label: 'Free' },
                      { value: 'one_time', label: 'One off payment' },
                    ]}
                    onChange={(event) => setPricingModel(event.target.value)}
                    {...fieldAccessibilityProps('listing-pricing', false, false)}
                  />
                </FormField>

                <FormField id="listing-price" label={`Price in ${currency}`}>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceAmount}
                    disabled={pricingModel === 'free'}
                    onChange={(event) => setPriceAmount(event.target.value)}
                    {...fieldAccessibilityProps('listing-price', false, false)}
                  />
                </FormField>

                <FormField id="listing-version" label="Version" isRequired>
                  <Input
                    value={version}
                    onChange={(event) => setVersion(event.target.value)}
                    required
                    {...fieldAccessibilityProps('listing-version', false, false)}
                  />
                </FormField>
              </div>

              <Button type="submit" isLoading={isSaving} loadingLabel="Saving">
                Save draft
              </Button>
            </form>
          ) : (
            <Alert tone="info" title="Your vendor account is still being read">
              You can write listings as soon as the platform team approves the account. We write to
              your support address the moment that happens.
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
