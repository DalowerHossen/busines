// src/components/ui/avatar.tsx
// A person or company picture, falling back to initials when there is none.

import Image from 'next/image';

import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

const SIZES = {
  sm: { box: 'h-8 w-8 text-xs', pixels: 32 },
  md: { box: 'h-10 w-10 text-sm', pixels: 40 },
  lg: { box: 'h-14 w-14 text-base', pixels: 56 },
} as const;

export interface AvatarProps {
  /** Name used for the initials and the accessible description. */
  name: string;
  /** Picture to show, when one has been uploaded. */
  src?: string | null;
  /** Size of the circle. */
  size?: keyof typeof SIZES;
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Renders a round picture or the initials of a name.
 *
 * @param props Name, picture and size.
 * @returns The rendered avatar.
 */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const dimensions = SIZES[size];

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={dimensions.pixels}
        height={dimensions.pixels}
        className={cn('rounded-full object-cover', dimensions.box, className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700',
        dimensions.box,
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
