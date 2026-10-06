// src/components/marketing/contact-details.tsx
// The ways to reach a person, shown beside the form so nobody has to fill in
// a form if they would rather not.

import { BookOpen, Clock, LifeBuoy, Mail } from 'lucide-react';
import Link from 'next/link';

import { ROUTES } from '@/config/app';
import { BRAND } from '@/config/brand';

interface ContactChannel {
  title: string;
  description: string;
  linkLabel: string;
  href: string;
  isExternal: boolean;
}

const CHANNELS: readonly ContactChannel[] = [
  {
    title: 'Email us',
    description: 'The quickest route for anything to do with an account, an invoice or a payment.',
    linkLabel: BRAND.supportEmail,
    href: `mailto:${BRAND.supportEmail}`,
    isExternal: true,
  },
  {
    title: 'Choosing a plan',
    description:
      'Not sure which plan fits? Read what each one includes, then tell us what you need and we will say honestly whether it is a fit.',
    linkLabel: 'See the plans',
    href: ROUTES.pricing,
    isExternal: false,
  },
  {
    title: 'Already have an account',
    description:
      'Sign in and use the help link in the dashboard: your account details come with the message, so we can answer faster.',
    linkLabel: 'Sign in',
    href: ROUTES.login,
    isExternal: false,
  },
];

const FACTS = [
  { icon: Clock, label: 'Answered within one working day, usually much sooner' },
  { icon: LifeBuoy, label: 'Support included on every plan, including the free one' },
  { icon: Mail, label: `Every message from us comes from ${BRAND.supportEmail}` },
  { icon: BookOpen, label: 'Ask for a walkthrough and we will book a call' },
] as const;

/**
 * Renders the contact channels and what to expect from us.
 *
 * @returns The rendered panel.
 */
export function ContactDetails() {
  return (
    <div className="space-y-6">
      <ul className="space-y-4">
        {CHANNELS.map((channel) => (
          <li
            key={channel.title}
            className="rounded-lg border border-border bg-surface p-5 shadow-xs"
          >
            <h3 className="text-base font-semibold text-foreground">{channel.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{channel.description}</p>
            {channel.isExternal ? (
              <a
                href={channel.href}
                className="mt-3 inline-flex min-h-touch items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {channel.linkLabel}
              </a>
            ) : (
              <Link
                href={channel.href}
                className="mt-3 inline-flex min-h-touch items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {channel.linkLabel}
              </Link>
            )}
          </li>
        ))}
      </ul>

      <div className="rounded-lg border border-border bg-surface-muted p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          What to expect
        </h3>
        <ul className="mt-3 space-y-2">
          {FACTS.map((fact) => (
            <li key={fact.label} className="flex items-start gap-3 text-sm text-foreground">
              <fact.icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
              <span>{fact.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
