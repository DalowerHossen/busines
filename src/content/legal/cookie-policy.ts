// src/content/legal/cookie-policy.ts
// Which cookies the website and the application set, what each one is for and
// how a visitor changes the answer they gave.

import { BRAND } from '@/config/brand';
import type { LegalDocument } from '@/content/legal/types';

export const COOKIE_POLICY: LegalDocument = {
  title: 'Cookie policy',
  summary: `The cookies ${BRAND.name} uses, grouped by what they do, and how to change what you allow.`,
  version: '2026-01-01',
  effectiveDate: '2026-01-01',
  sections: [
    {
      id: 'what',
      heading: '1. What a cookie is',
      paragraphs: [
        'A cookie is a small file a website asks your browser to keep. It lets the site recognise the same browser on the next page, which is how a session stays signed in and how a preference survives a reload.',
        'We also use two similar technologies: local storage, which keeps a setting in your browser, and a pixel, which is an image request used to count a visit. Where we say cookie below, we mean all three.',
      ],
    },
    {
      id: 'necessary',
      heading: '2. Strictly necessary cookies',
      paragraphs: [
        'These are set whenever you use the service, because without them it cannot work. They do not track you across other websites.',
      ],
      bullets: [
        'Session cookie: keeps you signed in and ends when you sign out.',
        'Security token: protects a form submission from being forged by another site.',
        'Visitor token: an anonymous identifier that lets us store your cookie choice and apply it on the next visit.',
        'Load balancing: keeps a request with the server that is already handling it.',
      ],
    },
    {
      id: 'preferences',
      heading: '3. Preference cookies',
      paragraphs: [
        'These remember how you like the interface to behave. Refusing them means the service still works, but you may have to set the same thing again.',
      ],
      bullets: [
        'The last business you were working in, when your login covers more than one.',
        'Table density, column choices and saved filters.',
        'Whether a guide or an announcement has already been dismissed.',
      ],
    },
    {
      id: 'analytics',
      heading: '4. Analytics cookies',
      paragraphs: [
        'These tell us which pages are used, where people get stuck and whether a change made things better. They load only after you agree, and the measurement is aggregated.',
      ],
      bullets: [
        'Page views, referring site and campaign parameters.',
        'Approximate country, derived from the network address and not stored in the clear.',
        'Product events such as an invoice being created, recorded without its contents.',
      ],
    },
    {
      id: 'marketing',
      heading: '5. Marketing cookies',
      paragraphs: [
        'These let us measure which advertisement or social post brought someone to the site, and avoid showing an advertisement to a person who already has an account. They load only after you agree, and never on a page inside a client document link.',
      ],
    },
    {
      id: 'control',
      heading: '6. Changing your choice',
      paragraphs: [
        'The banner on your first visit lets you accept everything, refuse everything that is not necessary, or choose category by category. Your answer is stored for twelve months and then we ask again.',
        'You can change the answer at any time from the cookie settings link in the footer of every page. You can also delete cookies in your browser settings, though doing so will sign you out and clear your preferences.',
      ],
    },
    {
      id: 'third-parties',
      heading: '7. Cookies set by others',
      paragraphs: [
        'When you pay through a gateway, that provider sets its own cookies on its own payment page for fraud prevention. When a video or a map is embedded, the provider of that content may set a cookie once the content loads. Those cookies are governed by the provider own policy, and we load such content only where the relevant category has been allowed.',
      ],
    },
    {
      id: 'contact',
      heading: '8. Contact',
      paragraphs: [
        `If anything here is unclear, write to ${BRAND.supportEmail} and we will explain it.`,
      ],
    },
  ],
};
