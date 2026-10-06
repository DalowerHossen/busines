// src/components/marketplace/install-button.tsx
// The one action on a listing page. A free template installs straight away;
// a paid one is ordered against the platform account first, and the button
// says so before it is pressed.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { notify } from '@/components/ui/toaster';
import { installTemplate } from '@/features/marketplace/actions/install-template';
import { formatMoney } from '@/lib/format';

export interface InstallButtonProps {
  /** Listing being installed. */
  listingId: string;
  /** Price model of the listing. */
  pricingModel: string;
  /** Price of the listing, ignored when it is free. */
  priceAmount: string;
  /** Currency the price is in. */
  priceCurrency: string;
  /** True when this business already runs the template. */
  isInstalled: boolean;
  /** False when the viewer is not the owner of a business that can install. */
  canInstall: boolean;
}

/**
 * Renders the install action and whatever has to be said next to it.
 *
 * @param props The listing and what the viewer is allowed to do with it.
 * @returns The rendered action.
 */
export function InstallButton({
  listingId,
  pricingModel,
  priceAmount,
  priceCurrency,
  isInstalled,
  canInstall,
}: InstallButtonProps) {
  const router = useRouter();
  const [isWorking, setIsWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (isInstalled) {
    return (
      <Alert tone="success" title="This template is already running">
        You can remove it from the Installed tab of the marketplace at any time.
      </Alert>
    );
  }

  if (!canInstall) {
    return (
      <Alert tone="info" title="Only the owner installs templates">
        Ask the owner of this business to install it, and it will be available to everybody here.
      </Alert>
    );
  }

  /**
   * Buys the template where there is something to pay, then installs it.
   *
   * @returns Nothing.
   */
  async function onInstall(): Promise<void> {
    setIsWorking(true);
    setFailure(null);

    const result = await installTemplate({ listingId });

    setIsWorking(false);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success(
      result.data.orderReference === null
        ? 'The template is installed.'
        : `The template is installed under order ${result.data.orderReference}.`
    );
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {failure === null ? null : (
        <Alert tone="danger" title="That did not work">
          {failure}
        </Alert>
      )}

      <Button
        type="button"
        isLoading={isWorking}
        loadingLabel="Installing"
        onClick={() => {
          void onInstall();
        }}
      >
        {pricingModel === 'free'
          ? 'Install for free'
          : `Buy for ${formatMoney(priceAmount, priceCurrency)}`}
      </Button>

      {pricingModel === 'free' ? null : (
        <p className="text-xs text-muted-foreground">
          The charge is added to your platform account and appears on your next platform invoice.
          The vendor is paid their share once the refund window has passed.
        </p>
      )}
    </div>
  );
}
