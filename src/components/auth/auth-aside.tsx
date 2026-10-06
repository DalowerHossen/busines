// src/components/auth/auth-aside.tsx
// The panel beside the authentication forms on a wide screen. It says what
// the product does rather than filling space with decoration.

import { Check, Quote } from 'lucide-react';

import { BRAND } from '@/config/brand';

const POINTS = [
  'Invoices your client can pay in one tap, from any device',
  'Reminders and recurring billing that run without you',
  'Reports your accountant accepts, exported in one click',
  'Your data separated from every other business, by design',
] as const;

/**
 * Renders the marketing panel shown beside an authentication form.
 *
 * @returns The rendered panel.
 */
export function AuthAside() {
  return (
    <aside className="hidden h-full flex-col justify-between bg-brand-700 p-10 text-white lg:flex">
      <div className="space-y-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-white/80">
          {BRAND.tagline}
        </p>

        <h2 className="max-w-md text-3xl font-semibold leading-tight">
          Billing that runs quietly in the background while you do the work.
        </h2>

        <ul className="space-y-3">
          {POINTS.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm text-white/90">
              <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>

      <figure className="max-w-md space-y-3 rounded-lg bg-white/10 p-5">
        <Quote aria-hidden="true" className="h-5 w-5 text-white/70" />
        <blockquote className="text-sm leading-relaxed text-white/90">
          We moved eleven years of invoicing across in an afternoon. The first month, two clients
          paid the day the invoice arrived because the payment link was right there.
        </blockquote>
        <figcaption className="text-sm text-white/70">
          Operations lead, a six person design studio
        </figcaption>
      </figure>
    </aside>
  );
}
