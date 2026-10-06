// src/app/(marketing)/contact/page.tsx
// The contact page: a form that reaches a person, and the ways to reach one
// without using the form.

import type { Metadata } from 'next';

import { ContactDetails } from '@/components/marketing/contact-details';
import { ContactForm } from '@/components/marketing/contact-form';
import { SectionHeading } from '@/components/marketing/section-heading';
import { JsonLd } from '@/components/seo/json-ld';
import { ROUTES } from '@/config/app';
import { BRAND } from '@/config/brand';
import { buildMetadata, siteUrl } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Contact',
  description: `Talk to the team behind ${BRAND.name}. Every message is answered by a person, usually within one working day.`,
  path: ROUTES.contact,
});

/**
 * Builds the structured data for the contact page.
 *
 * @returns A JSON-LD contact page record.
 */
function contactJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: `Contact ${BRAND.name}`,
    url: `${siteUrl()}${ROUTES.contact}`,
    mainEntity: {
      '@type': 'Organization',
      name: BRAND.legalName,
      email: BRAND.supportEmail,
      contactPoint: [
        {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: BRAND.supportEmail,
          availableLanguage: 'English',
        },
      ],
    },
  };
}

/**
 * Renders the contact page.
 *
 * @returns The rendered page.
 */
export default function ContactPage() {
  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-brand-50 to-background">
        <div className="mx-auto w-full max-w-content px-4 py-14 sm:px-6">
          <SectionHeading
            level="h1"
            eyebrow="Contact"
            title="Tell us what you need and we will tell you straight"
            description="Whether you are choosing a plan, moving your books across or stuck on something, write to us and a person will answer."
          />
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto grid w-full max-w-content gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Send us a message
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Fields marked as required are the ones we need in order to reply.
            </p>

            <div className="mt-6">
              <ContactForm />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Other ways</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Pick whichever is easiest; they all reach the same team.
            </p>

            <div className="mt-6">
              <ContactDetails />
            </div>
          </div>
        </div>
      </section>

      <JsonLd data={contactJsonLd()} />
    </>
  );
}
