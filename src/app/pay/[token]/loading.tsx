// src/app/pay/[token]/loading.tsx
// The outline of the payment page while the invoice is being read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the payment page skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function CheckoutLoading() {
  return (
    <div className="mx-auto w-full max-w-content space-y-4" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Opening your payment page</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-11 w-48 rounded-md" />
    </div>
  );
}
