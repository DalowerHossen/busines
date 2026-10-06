import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description?: string;
  readonly align?: 'left' | 'center';
  readonly className?: string;
}): ReactNode {
  return (
    <div className={cn(align === 'center' && 'mx-auto max-w-2xl text-center', className)}>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
