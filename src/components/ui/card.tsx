// src/components/ui/card.tsx
// The panel that holds a section of a page.

import { type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type CardProps = HTMLAttributes<HTMLDivElement>;

/**
 * Renders a panel with a border and a soft shadow.
 *
 * @param props Standard division attributes.
 * @returns The rendered card.
 */
export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card text-card-foreground shadow-xs',
        className
      )}
      {...props}
    />
  );
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** Buttons or links shown on the right of the header. */
  actions?: ReactNode;
}

/**
 * Renders the top band of a card, with optional actions on the right.
 *
 * @param props Header content and actions.
 * @returns The rendered header.
 */
export function CardHeader({ className, children, actions, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
      {...props}
    >
      <div className="space-y-1">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * Renders the title inside a card header.
 *
 * @param props Heading attributes.
 * @returns The rendered title.
 */
export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-base font-semibold text-foreground', className)} {...props} />;
}

/**
 * Renders the supporting line under a card title.
 *
 * @param props Paragraph attributes.
 * @returns The rendered description.
 */
export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

/**
 * Renders the body of a card.
 *
 * @param props Standard division attributes.
 * @returns The rendered body.
 */
export function CardContent({ className, ...props }: CardProps) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}

/**
 * Renders the footer of a card, usually holding the primary action.
 *
 * @param props Standard division attributes.
 * @returns The rendered footer.
 */
export function CardFooter({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-end',
        className
      )}
      {...props}
    />
  );
}
