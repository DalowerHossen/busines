// src/lib/seo/metadata.ts
// Page metadata in one place, so every page has a title, a description, a
// canonical address and a social preview without repeating itself.

import type { Metadata } from 'next';

import { BRAND } from '@/config/brand';
import { clientEnv } from '@/env/client';

export interface PageMetadataInput {
  /** Title of the page, without the product name. */
  title: string;
  /** One sentence shown in search results and link previews. */
  description: string;
  /** Path of the page, beginning with a slash. */
  path: string;
  /** True to keep the page out of search results. */
  noIndex?: boolean;
  /** Address of the social preview image. */
  imagePath?: string;
}

/**
 * Returns the base address of the application without a trailing slash.
 *
 * @returns An absolute address.
 */
export function siteUrl(): string {
  return clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
}

/**
 * Builds the metadata of one page.
 *
 * @param input Title, description and path of the page.
 * @returns Metadata for the Next.js router.
 */
export function buildMetadata(input: PageMetadataInput): Metadata {
  const url = `${siteUrl()}${input.path}`;
  const title = `${input.title} | ${BRAND.name}`;

  return {
    title,
    description: input.description,
    alternates: { canonical: url },
    robots: input.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: 'website',
      siteName: BRAND.name,
      title,
      description: input.description,
      url,
      images: input.imagePath ? [{ url: `${siteUrl()}${input.imagePath}` }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: input.description,
    },
  };
}

/**
 * Builds the structured data that describes the business itself.
 *
 * @returns A JSON-LD organisation record.
 */
export function organisationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND.legalName,
    url: siteUrl(),
    email: BRAND.supportEmail,
    slogan: BRAND.tagline,
    sameAs: [BRAND.social.facebook, BRAND.social.linkedin, BRAND.social.x, BRAND.social.youtube],
  };
}

/**
 * Builds the structured data that describes the product.
 *
 * @returns A JSON-LD software application record.
 */
export function softwareJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: BRAND.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: BRAND.description,
    url: siteUrl(),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free plan with paid plans available.',
    },
  };
}

/**
 * Builds the structured data for a list of questions and answers.
 *
 * @param entries Questions and their answers.
 * @returns A JSON-LD frequently asked questions record.
 */
export function faqJsonLd(
  entries: readonly { question: string; answer: string }[]
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
}
