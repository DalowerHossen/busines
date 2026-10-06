// src/components/marketing/site-footer.tsx
// The foot of the public website: what the product is, where to go next and
// how to reach a person.

import { Facebook, Linkedin, Twitter, Youtube, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { CookieSettingsLink } from '@/components/consent/cookie-settings-link';
import { Logo } from '@/components/brand/logo';
import { BRAND } from '@/config/brand';
import { FOOTER_SECTIONS } from '@/config/marketing';

interface SocialLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

const SOCIAL_LINKS: readonly SocialLink[] = [
  { label: 'Facebook', href: BRAND.social.facebook, icon: Facebook },
  { label: 'LinkedIn', href: BRAND.social.linkedin, icon: Linkedin },
  { label: 'X', href: BRAND.social.x, icon: Twitter },
  { label: 'YouTube', href: BRAND.social.youtube, icon: Youtube },
];

/**
 * Renders the public footer.
 *
 * @returns The rendered footer.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface-muted">
      <div className="mx-auto w-full max-w-content px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-sm text-sm text-muted-foreground">{BRAND.description}</p>
            <p className="text-sm text-muted-foreground">
              Questions?{' '}
              <a
                href={`mailto:${BRAND.supportEmail}`}
                className="font-medium text-primary hover:underline"
              >
                {BRAND.supportEmail}
              </a>
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <nav key={section.title} aria-label={section.title} className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    {link.href.startsWith('mailto:') ? (
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            &copy; {year} {BRAND.legalName}. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <CookieSettingsLink />
            <ul className="flex items-center gap-3">
              {SOCIAL_LINKS.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="flex h-11 min-h-touch w-11 min-w-touch items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-surface hover:text-foreground"
                  >
                    <social.icon aria-hidden="true" className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">{BRAND.tagline}</p>
      </div>
    </footer>
  );
}
