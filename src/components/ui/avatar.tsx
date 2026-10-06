'use client';

import Image from 'next/image';
import { forwardRef, useState, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  readonly src?: string | null;
  readonly alt?: string;
  readonly name?: string;
  readonly fallback?: string;
  readonly size?: 'sm' | 'md' | 'lg';
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, src, alt, name, fallback, size = 'md', ...props }, ref) => {
    const [hasError, setHasError] = useState(false);
    const resolvedAlt = alt ?? name ?? 'User';
    const sizeClass = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-base' }[
      size
    ];
    const imageSize = { sm: 32, md: 40, lg: 56 }[size];
    const initials = fallback || resolvedAlt.slice(0, 1).toUpperCase();
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex shrink-0 overflow-hidden rounded-full bg-brand-100 font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200',
          sizeClass,
          className
        )}
        {...props}
      >
        {src && !hasError ? (
          <Image
            src={src}
            alt={resolvedAlt}
            width={imageSize}
            height={imageSize}
            unoptimized
            className="h-full w-full object-cover"
            onError={() => setHasError(true)}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center" aria-label={resolvedAlt}>
            {initials.slice(0, 2)}
          </span>
        )}
      </span>
    );
  }
);
Avatar.displayName = 'Avatar';
