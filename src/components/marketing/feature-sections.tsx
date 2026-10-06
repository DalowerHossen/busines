// src/components/marketing/feature-sections.tsx
// The body of the features page: one block per capability, alternating sides
// on a wide screen and stacking on a narrow one.

import {
  BarChart3,
  Boxes,
  Briefcase,
  Check,
  FileText,
  Plug,
  Receipt,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { FEATURE_BLOCKS, type FeatureIconName } from '@/config/content/features-page';
import { cn } from '@/lib/utils';

const ICONS: Readonly<Record<FeatureIconName, LucideIcon>> = {
  invoice: FileText,
  payments: Wallet,
  recurring: RefreshCw,
  reminders: Send,
  clients: Users,
  expenses: Receipt,
  reports: BarChart3,
  security: ShieldCheck,
  projects: Briefcase,
  inventory: Boxes,
  team: Users,
  integrations: Plug,
};

/**
 * Renders every feature block of the features page.
 *
 * @returns The rendered sections.
 */
export function FeatureSections() {
  return (
    <div className="divide-y divide-border">
      {FEATURE_BLOCKS.map((block, index) => {
        const Icon = ICONS[block.icon];
        const isReversed = index % 2 === 1;

        return (
          <section
            key={block.id}
            id={block.id}
            aria-labelledby={`${block.id}-title`}
            className={cn('scroll-mt-24', isReversed ? 'bg-surface-muted' : 'bg-background')}
          >
            <div className="mx-auto grid w-full max-w-content gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-start lg:gap-12">
              <div className={cn('space-y-4', isReversed ? 'lg:order-2' : '')}>
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>

                <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
                  {block.eyebrow}
                </p>

                <h2
                  id={`${block.id}-title`}
                  className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
                >
                  {block.title}
                </h2>

                <p className="text-base text-muted-foreground">{block.description}</p>
              </div>

              <ul
                className={cn(
                  'grid gap-3 rounded-lg border border-border bg-surface p-5 shadow-xs sm:grid-cols-2 lg:grid-cols-1',
                  isReversed ? 'lg:order-1' : ''
                )}
              >
                {block.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-foreground">
                    <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}
