// src/components/marketing/feature-grid.tsx
// The grid of what the product does, written as outcomes rather than as a
// list of screens.

import {
  BarChart3,
  FileText,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { FEATURES, type FeatureCard } from '@/config/marketing';

const ICONS: Readonly<Record<FeatureCard['icon'], LucideIcon>> = {
  invoice: FileText,
  payments: Wallet,
  clients: Users,
  reminders: RefreshCw,
  reports: BarChart3,
  security: ShieldCheck,
  recurring: RefreshCw,
  expenses: Receipt,
};

export interface FeatureGridProps {
  /** Heading above the grid. */
  title?: string;
  /** Sentence under the heading. */
  description?: string;
}

/**
 * Renders the grid of product capabilities.
 *
 * @param props Heading and description.
 * @returns The rendered grid.
 */
export function FeatureGrid({
  title = 'Everything billing needs, nothing it does not',
  description = 'One place for invoices, payments, recurring billing, expenses and the reports your accountant asks for.',
}: FeatureGridProps) {
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-content px-4 py-16 sm:px-6">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h2>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => {
            const Icon = ICONS[feature.icon];

            return (
              <li
                key={feature.title}
                className="flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-xs"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="text-base font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
