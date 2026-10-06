// src/components/brand/logo.tsx
// The product mark. It is drawn rather than loaded, so it is sharp at every
// size, needs no network request and follows the brand colour token.

import Link from 'next/link';

import { BRAND } from '@/config/brand';
import { cn } from '@/lib/utils';

export interface LogoProps {
  /** Hides the words and shows the mark alone. */
  isCompact?: boolean;
  /** Renders the mark for a dark background. */
  isInverted?: boolean;
  /** Where the logo links to. */
  href?: string;
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Renders the product mark, linked to the page it belongs with.
 *
 * @param props Size, colour and link target.
 * @returns The rendered logo.
 */
export function Logo({ isCompact = false, isInverted = false, href = '/', className }: LogoProps) {
  return (
    <Link
      href={href}
      aria-label={`${BRAND.name} home`}
      className={cn('inline-flex items-center gap-2.5 rounded-md', className)}
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" focusable="false">
          <path
            d="M5 4h4v6.2L14.4 4H19l-6.3 7.4L19.4 20H14.6L9.7 13.5 9 14.3V20H5V4Z"
            fill="currentColor"
          />
        </svg>
      </span>

      {!isCompact ? (
        <span className="flex flex-col leading-tight">
          <span
            className={cn(
              'font-heading text-sm font-semibold tracking-tight',
              isInverted ? 'text-white' : 'text-foreground'
            )}
          >
            {BRAND.name}
          </span>
          <span className={cn('text-2xs', isInverted ? 'text-white/70' : 'text-muted-foreground')}>
            {BRAND.tagline}
          </span>
        </span>
      ) : null}
    </Link>
  );
}
