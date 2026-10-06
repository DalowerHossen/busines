// src/app/(marketing)/[...slug]/page.tsx
// Any public address that is not a built page: a page written in the
// website editor, an address that has moved, or nothing at all.
//
// This is also where the redirect table is honoured. A link somebody shared
// two years ago still arrives somewhere useful, which is the whole reason
// the table exists.

import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';

import { PublicPageBody } from '@/components/marketing/public-page-body';
import { followRedirect, loadPublicPage } from '@/features/site/queries/get-public-page';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export interface PublicPageProps {
  /** The address that was asked for. */
  params: { slug: string[] };
}

/**
 * Describes the page for search engines and for anybody sharing a link.
 *
 * @param props The address that was asked for.
 * @returns The metadata of the page.
 */
export async function generateMetadata({ params }: PublicPageProps): Promise<Metadata> {
  const slug = params.slug.join('/');
  const page = await loadPublicPage(slug);

  if (page === null) {
    return buildMetadata({
      title: 'Page not found',
      description: 'That address does not lead anywhere on this site.',
      path: `/${slug}`,
      noIndex: true,
    });
  }

  const isIndexable = page.robotsDirective.startsWith('index');

  return buildMetadata({
    title: page.metaTitle ?? page.title,
    description:
      page.metaDescription ?? page.excerpt ?? 'A page from the people who build this platform.',
    path: `/${page.slug}`,
    noIndex: !isIndexable,
    imagePath: `/api/og?title=${encodeURIComponent(page.title)}`,
  });
}

/**
 * Renders a page written in the website editor.
 *
 * @param props The address that was asked for.
 * @returns The rendered page.
 */
export default async function EditorPage({ params }: PublicPageProps) {
  const slug = params.slug.join('/');
  const page = await loadPublicPage(slug);

  if (page === null) {
    const moved = await followRedirect(`/${slug}`);

    if (moved !== null) {
      if (moved.status === 301 || moved.status === 308) {
        permanentRedirect(moved.target);
      }

      redirect(moved.target);
    }

    notFound();
  }

  return <PublicPageBody page={page} />;
}
