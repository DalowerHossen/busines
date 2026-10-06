// src/app/pay/[token]/result/loading.tsx
// The outline of the result page while the invoice is read again.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the result page skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function CheckoutResultLoading() {
  return (
    <div className="mx-auto w-full max-w-content space-y-4" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Checking your payment</span>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-4 w-64 max-w-full" />
    </div>
  );
}
