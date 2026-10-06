// src/components/marketing/public-page-body.tsx
// Rendering a page that was written in the website editor rather than in
// code.
//
// The blocks are deliberately few and plain: a heading, a paragraph, a list,
// a quote, a call to action. A page builder with forty block types produces
// pages that look like a page builder; five good ones produce pages that
// look like a company wrote them.

import Link from 'next/link';

import type { PublicPage } from '@/features/site/types';
import { formatDate } from '@/lib/dates';

export interface PublicPageBodyProps {
  /** The page being rendered. */
  page: PublicPage;
}

/**
 * Renders a page from the website editor.
 *
 * @param props The page being rendered.
 * @returns The rendered page.
 */
export function PublicPageBody({ page }: PublicPageBodyProps) {
  return (
    <article className="mx-auto w-full max-w-content px-4 py-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {page.title}
        </h1>

        {page.excerpt === null ? null : (
          <p className="text-lg text-muted-foreground">{page.excerpt}</p>
        )}

        {page.updatedAt === '' ? null : (
          <p className="text-sm text-muted-foreground">
            {`Last updated ${formatDate(page.updatedAt)}`}
          </p>
        )}
      </header>

      <div className="mt-10 space-y-8">
        {page.blocks.map((block, index) => {
          const key = `${block.kind}-${String(index)}`;

          if (block.kind === 'list') {
            return (
              <section key={key} className="space-y-3">
                {block.heading === null ? null : (
                  <h2 className="text-xl font-semibold text-foreground">{block.heading}</h2>
                )}
                <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            );
          }

          if (block.kind === 'quote') {
            return (
              <blockquote
                key={key}
                className="border-l-4 border-brand-600 pl-4 text-lg italic text-foreground"
              >
                {block.body}
              </blockquote>
            );
          }

          if (block.kind === 'call_to_action') {
            return (
              <section key={key} className="rounded-lg bg-brand-50 p-6">
                {block.heading === null ? null : (
                  <h2 className="text-xl font-semibold text-brand-700">{block.heading}</h2>
                )}
                {block.body === null ? null : (
                  <p className="mt-2 text-muted-foreground">{block.body}</p>
                )}
                <Link
                  href="/register"
                  className="mt-4 inline-flex min-h-touch items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white shadow-xs"
                >
                  Start free
                </Link>
              </section>
            );
          }

          return (
            <section key={key} className="space-y-3">
              {block.heading === null ? null : (
                <h2 className="text-xl font-semibold text-foreground">{block.heading}</h2>
              )}
              {block.body === null ? null : (
                <p className="whitespace-pre-line text-muted-foreground">{block.body}</p>
              )}
            </section>
          );
        })}
      </div>
    </article>
  );
}
