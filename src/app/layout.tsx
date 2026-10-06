// src/app/layout.tsx
// The shell every page is rendered inside: the document language, the type
// faces, the colour scheme and the region that holds notifications.

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import '@/app/globals.css';

import { JsonLd } from '@/components/seo/json-ld';
import { Toaster } from '@/components/ui/toaster';
import { BRAND } from '@/config/brand';
import { organisationJsonLd, siteUrl } from '@/lib/seo/metadata';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${BRAND.name} - ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  authors: [{ name: BRAND.legalName }],
  creator: BRAND.legalName,
  publisher: BRAND.legalName,
  formatDetection: { email: false, address: false, telephone: false },
  referrer: 'no-referrer',
  openGraph: {
    type: 'website',
    siteName: BRAND.name,
    title: `${BRAND.name} - ${BRAND.tagline}`,
    description: BRAND.description,
    url: siteUrl(),
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} - ${BRAND.tagline}`,
    description: BRAND.description,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: BRAND.colors.primary,
};

export interface RootLayoutProps {
  /** The page being rendered. */
  children: ReactNode;
}

/**
 * Renders the document shell.
 *
 * @param props The page being rendered.
 * @returns The rendered document.
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
        <Toaster />
        <JsonLd data={organisationJsonLd()} />
      </body>
    </html>
  );
}
