// src/components/marketing/section-heading.tsx
// The heading that opens a section of the public website, so every section
// starts with the same rhythm.

import { cn } from '@/lib/utils';

export interface SectionHeadingProps {
  /** Small label printed above the title. */
  eyebrow?: string;
  /** The heading itself. */
  title: string;
  /** One or two sentences under the heading. */
  description?: string;
  /** Centres the block, for sections that are not laid out in columns. */
  isCentred?: boolean;
  /** Heading level, so the page keeps one logical outline. */
  level?: 'h1' | 'h2';
  className?: string;
}

/**
 * Renders the heading block of a section.
 *
 * @param props Heading text and layout choices.
 * @returns The rendered heading.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  isCentred = false,
  level = 'h2',
  className,
}: SectionHeadingProps) {
  const Heading = level;

  return (
    <div
      className={cn(
        'space-y-3',
        isCentred ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl',
        className
      )}
    >
      {eyebrow ? (
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">{eyebrow}</p>
      ) : null}

      <Heading
        className={cn(
          'font-semibold tracking-tight text-foreground',
          level === 'h1' ? 'text-3xl sm:text-4xl lg:text-5xl' : 'text-2xl sm:text-3xl'
        )}
      >
        {title}
      </Heading>

      {description ? <p className="text-base text-muted-foreground">{description}</p> : null}
    </div>
  );
}
