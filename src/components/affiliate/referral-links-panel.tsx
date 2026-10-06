// src/components/affiliate/referral-links-panel.tsx
// The links a partner shares, with the visits each one brought. Copying a
// link is one tap, because that is the action partners take most.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
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
import { saveAffiliateLink } from '@/features/affiliates/actions/save-affiliate-link';
import type { AffiliateLink } from '@/features/affiliates/types';
import { clientEnv } from '@/lib/env/env.client';
import { formatNumber } from '@/lib/format';

export interface ReferralLinksPanelProps {
  /** Links this partner has already created. */
  links: readonly AffiliateLink[];
  /** False while the application is still being reviewed. */
  isApproved: boolean;
}

/**
 * Builds the address a partner shares.
 *
 * @param slug Name of the link.
 * @param destinationPath Page the visitor lands on.
 * @returns The full address.
 */
function shareUrl(slug: string, destinationPath: string): string {
  const base = `${clientEnv.NEXT_PUBLIC_APP_URL}/r/${slug}`;

  return destinationPath === '/' ? base : `${base}?to=${destinationPath}`;
}

/**
 * Renders the referral links.
 *
 * @param props The links and whether the partner is approved.
 * @returns The rendered card.
 */
export function ReferralLinksPanel({ links, isApproved }: ReferralLinksPanelProps) {
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [label, setLabel] = useState('');
  const [destinationPath, setDestinationPath] = useState('/');
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /**
   * Creates a link.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);

    const result = await saveAffiliateLink({
      slug,
      label,
      destinationPath,
      isActive: true,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    setSlug('');
    setLabel('');
    setDestinationPath('/');
    notify.success('Link created.');
    router.refresh();
  }

  /**
   * Puts a link on the clipboard.
   *
   * @param link Link being copied.
   * @returns Nothing.
   */
  async function onCopy(link: AffiliateLink): Promise<void> {
    try {
      await navigator.clipboard.writeText(shareUrl(link.slug, link.destinationPath));
      setCopiedId(link.id);
      notify.success('Link copied.');
    } catch {
      setFailure('Your browser would not let us copy. Select the address and copy it by hand.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your links</CardTitle>
        <CardDescription>
          Every visit through one of these is counted for ninety days, and the last link a visitor
          used is the one that earns.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {failure ? (
          <Alert tone="danger" title="That did not work">
            {failure}
          </Alert>
        ) : null}

        {links.length === 0 ? (
          <EmptyState
            title="No links yet"
            description="Create one below and share it anywhere you write about us."
          />
        ) : (
          <Table caption="Referral links and the traffic they brought">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead isNumeric>Visits</TableHead>
                <TableHead isNumeric>Signups</TableHead>
                <TableHead>
                  <span className="visually-hidden">Copy</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => (
                <TableRow key={link.id}>
                  <TableCell>{link.label}</TableCell>
                  <TableCell>
                    <span className="break-all text-xs text-muted-foreground">
                      {shareUrl(link.slug, link.destinationPath)}
                    </span>
                  </TableCell>
                  <TableCell isNumeric>{formatNumber(link.clickCount)}</TableCell>
                  <TableCell isNumeric>{formatNumber(link.signupCount)}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void onCopy(link);
                      }}
                    >
                      {copiedId === link.id ? 'Copied' : 'Copy'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {isApproved ? (
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-4" noValidate>
            <FormField id="link-label" label="Name">
              <Input
                {...fieldAccessibilityProps('link-label', false, false)}
                value={label}
                onChange={(event) => {
                  setLabel(event.target.value);
                }}
              />
            </FormField>

            <FormField id="link-slug" label="Link code">
              <Input
                {...fieldAccessibilityProps('link-slug', false, false)}
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value.toLowerCase());
                }}
              />
            </FormField>

            <FormField id="link-destination" label="Lands on">
              <Input
                {...fieldAccessibilityProps('link-destination', false, false)}
                value={destinationPath}
                onChange={(event) => {
                  setDestinationPath(event.target.value);
                }}
              />
            </FormField>

            <div className="flex items-end">
              <Button type="submit" isLoading={isSaving} loadingLabel="Saving" className="w-full">
                Add link
              </Button>
            </div>
          </form>
        ) : (
          <Alert tone="info" title="Links open up once you are approved">
            Your default link is ready and waiting; it starts counting the moment we approve you.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
